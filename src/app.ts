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
  time_format,
} from "./types_sock";
import { DummyClient, create_dummy, create_fake_user } from "./lib/DummyClient";
import {
  //
  REDIS_H,
  IS_DEV,
  unix_time,
  g,
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
import { game_room_map } from "./lib/GameRoom";

export const app = express();
// const server: HTTP_SERVER = http.createServer(app);

app.get("/", (_req, res) => {
  res.send("ok");
});

// 상태보기
// http://localhost:3000/status_pw
// https://port-0-pinballwar-socketio-lz5h4e1jf52ea16b.sel4.cloudtype.app/status_pw
function proc_status_pw() {
  //
  const now = unix_time();
  let text = " # server status";

  text += `\n ver: ${g.ver}`;
  text += `\n start_time: ${g.start_time}`;
  text += `\n connect_count: ${g.connect_count}`;
  text += `\n packet_count: ${g.packet_count}`;

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  text += `\n timezone: ${timezone}`;
  const time = time_format();
  text += `\n time: ${time}`;

  if (IS_DEV) {
    text += `\n IS_DEV: ${IS_DEV}`;
  }

  text += `\n # waitroom`;
  text += `\n dummy: ${dummy_list.length}`;
  text += `\n client: ${client_list.length}`;
  text += `\n closed: ${closed_list.length}`;

  let wait_dummy = 0;
  for (const i in wait_room.list) {
    const wait = wait_room.list[i];
    if (wait.is_dummy) wait_dummy++;
  }

  let state_map: number[] = [];
  for (const i in dummy_list) {
    const d = dummy_list[i];
    if (state_map[d.state] === undefined) {
      state_map[d.state] = 1;
    } else {
      state_map[d.state]++;
    }
  }

  // waitroom
  text += `\n`;
  text += `\n  # waitroom total=${wait_room.list.length} dummy=${wait_dummy}`;
  for (const i in wait_room.list) {
    const wait = wait_room.list[i];
    const wtime = now - wait.time;
    text += `\n  ${i}. ${wait.user_uid}, c:${wait.country}, wtime:${wtime} ago`;
  }

  //
  text += `\n`;
  text += `\n # dummy_list ${dummy_list.length}`;
  state_map.forEach((n, i) => {
    const sname = get_dummy_state(i);
    text += `\n  ${sname}: ${n}`;
  });

  for (const i in dummy_list) {
    const d = dummy_list[i];
    const c = d as any as WebSocket2;

    {
      const dsec = now - d.state_time;
      const htime = `${dsec} ago`;
      const sname = get_dummy_state(d.state);
      text += `\n  index:${d.index}. status:${sname} / ${htime}`;
    }

    if (c.is_waitroom) {
      text += `\n    u:${c.user_uid}, wait, c:${c.session.country}`;
    } else if (c.game_room !== null) {
      text += `\n    u:${c.user_uid}, game, game_id:${c.game_room.game_id} c:${c.session.country}, team:${c.session.team}`;
    } else {
      text += `\n    u:${c.user_uid}, else`;
    }
  }

  return text;
}
app.get("/status_pw", (_req, res) => {
  try {
    const text = proc_status_pw();
    res.send(`
<pre>
${text}
</pre>
      `);
  } catch (e) {
    console.log("/proc_status_pw fail", e);
    res.status(500);
    res.send("fail");
  }
});

// 게임방 상태 보기
// http://localhost:3000/status_pw/game/2
// https://port-0-pinballwar-socketio-lz5h4e1jf52ea16b.sel4.cloudtype.app/status_pw/game/2
function proc_status_pw_game(game_id: string) {
  const now = unix_time();
  let text = `# game ${game_id}`;

  if (game_room_map[game_id] === undefined) {
    text += `\n  not found game_id=${text}`;
    return text;
  }

  const game = game_room_map[game_id];
  const elapse = now - game.time_create;
  text += `\n  elapse: ${elapse}`;
  text += `\n  game_start: ${game.game_start}`;
  text += `\n  team_id_max: ${game.team_id_max}`;
  for (const k in game.country_team_map) {
    const n = game.country_team_map;
    text += `\n  country_team_map: ${k}= ${n}`;
  }

  for (const i in game.user_list) {
    const u = game.user_list[i];

    const last_recv = now - u.last_recv;
    text += `\n  user: ${u.user_uid}`;
    text += `\n    game_data: ${u.game_data}`;
    text += `\n    last_recv: ${last_recv} ago`;

    if (u.is_dummy_class) {
      const d = u as any as DummyClient;
      const time_state = now - d.state_time;
      const sname = get_dummy_state(d.state);
      const left_time = d.next_action - now;
      text += `\n    dummy: ${d.user_uid}`;
      text += `\n      state: ${sname} / ${time_state} ago`;
      text += `\n      action: ${left_time} left`;
    }
  }

  return text;
}
app.get("/status_pw/game/:game_id", (req, res) => {
  try {
    const game_id = req.params.game_id;
    let text = proc_status_pw_game(game_id);

    res.setHeader("content-type", "text/plain");
    res.send(text);
  } catch (e) {
    console.log("proc_status_pw_game fail", e);
    res.status(500);
    res.send("fail");
  }
});

let update_count = 0;
export function init_socket_io(server: HttpServer2) {
  console.log("init_socket_io start");

  const io = new WSServer(server);
  io.on("connection", on_connection);

  // 자주 업데이트
  setInterval(() => {
    try {
      update_server();
    } catch (e) {
      console.log("update_server_catch", e);
    }
  }, 1000);

  if (IS_DEV) {
    // 유저같은 더미 생성
    create_fake_user();
  }
}

//
function update_server() {
  update_count++;
  if (update_count % 5 == 0) {
    // 접속자 업데이트
    on_update_client();
  }
  if (update_count % 3 == 0) {
    // 대기방 업데이트
    on_update_waitroot();
  }
}
