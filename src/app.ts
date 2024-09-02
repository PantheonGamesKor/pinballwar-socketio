// app.ts
import express from "express";
import {
  //
  on_connection,
  on_update_client,
  on_update_waitroot,
} from "./ws";
import {
  //
  HttpServer2,
  WebSocket2,
  WSServer,
} from "./types_sock";
import { DummyClient, create_dummy, create_fake_user } from "./lib/DummyClient";
import {
  //
  REDIS_H,
  IS_DEV,
  unix_time,
} from "./lib/helper";
import { WaitRoom, wait_room } from "./lib/WaitRoom";
import {
  //
  client_list,
  closed_list,
} from "./lib/ClientManager";
import {
  //
  dummy_list,
  get_dummy_state,
} from "./lib/DummyClient";
import moment from "moment";

export const app = express();
// const server: HTTP_SERVER = http.createServer(app);

app.get("/", (_req, res) => {
  res.send("ok");
});

// 상태보기
// http://localhost:3000/status_pw
app.get("/status_pw", (_req, res) => {
  try {
    const text = print_status();
    res.send(text);
  } catch (e) {
    res.status(500);
    console.log("/status_pw fail", e);
    res.send("fail");
  }
});

// 상태 출력
function print_status(): string {
  const now = unix_time();
  let text = "  # waitroom";
  text += `\n  dc: ${dummy_list.length}`;
  text += `\n  cl: ${client_list.length}`;
  text += `\n  ol: ${closed_list.length}`;

  // waitroom
  text += `\n`;
  text += `\n  # waitroom ${wait_room.list.length}`;
  for (const i in wait_room.list) {
    const wait = wait_room.list[i];
    text += `\n  ${i}. ${wait.user_uid} c:${wait.country}`;
  }

  //
  text += `\n`;
  text += `\n  # dummy_list ${dummy_list.length}`;
  for (const i in dummy_list) {
    const d = dummy_list[i];
    const c = d as any as WebSocket2;

    {
      const dsec = now - d.state_time;
      const htime = `${dsec} ago`;
      const sname = get_dummy_state(d.state);
      text += `\n  ${i}. status:${sname} / ${htime}`;
    }

    if (c.is_waitroom) {
      text += `\n  - u:${c.user_uid} wait c:${c.session.country}`;
    } else if (c.game_room !== null) {
      text += `\n  - u:${c.user_uid} game c:${c.session.country} t:${c.session.team}`;
    } else {
      text += `\n  - u:${c.user_uid} else`;
    }
  }

  return `
<pre>
${text}
</pre>
  `;
}

let update_count = 0;
export function init_socket_io(server: HttpServer2) {
  console.log("init_socket_io start");

  const io = new WSServer(server);
  io.on("connection", on_connection);

  // 자주 업데이트
  setInterval(() => {
    update_count++;
    if (update_count % 5 == 0) {
      // 접속자 업데이트
      on_update_client();
    }
    if (update_count % 3 == 0) {
      // 대기방 업데이트
      on_update_waitroot();
    }
  }, 1000);

  if (IS_DEV) {
    // 유저같은 더미 생성
    create_fake_user();
  }
}
