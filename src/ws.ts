// ws.ts
import {
  //
  unix_time,
  time_format,
  //
  WebSocket,
  WebSocket2,
  //
  NS_Echo,
} from "./types_sock";
import {
  //
  client_list,
  closed_list,
  close_ws,
} from "./lib/ClientManager";
import {
  //
  proc_ws_map,
} from "./lib/ProcPacket";
// import { game_room_map } from "./lib/GameRoom";
import { wait_room } from "./lib/WaitRoom";
import {
  TokenData,
  //
  get_redis,
  redis_key,
} from "./lib/myredis";
import {
  //
  EXTERNAL_URL,
  g,
  random,
  SERVER_NAME,
} from "./lib/helper";
import { on_dummy_update } from "./lib/DummyProc";
import { DummyClient } from "./lib/DummyClient";

const LIVE_RECV_TIME = 60; // 초단위, 통신이 없어도 유지하는 시간

export function on_connection(_sock: WebSocket) {
  g.connect_count++;

  const client = _sock as WebSocket2;

  // 초기화 - 시작
  {
    // 빈자리가 없으면 추가한다.
    if (closed_list.length < 1) {
      client_list.push(null);
      closed_list.push(client_list.length - 1);
    }

    client.index = closed_list.pop() as number;
    client_list[client.index] = client;
    console.log("on_connection", client.index);

    // client.session = {} as TokenData;
    client.user_uid = 0;
    client.is_waitroom = false; // conn
    client.game_room = null;
    client.load_complete = false;

    client.last_recv = unix_time();
    client.last_update = unix_time();

    client.game_data = {
      attr: 0,
      ball: 1,
      speed: 1,
      gold_spend: 0,
      cash_spend: 0,
    };

    // func override
    if (client.is_dummy_class) {
      // 더미는 할일 없음
    } else {
      client.send_text = (text) => {
        client.emit("message", text);
      };
      client.send_res = (res) => {
        const res_text = res.to_data();
        client.emit("message", res_text);
      };
    }
  }
  // 초기화 -끝

  client.on("message", (_msg) => {
    g.packet_count++;

    let arr: string[] = [];

    try {
      if (client.index < 0) {
        close_ws(client, "recv but index < 0");
        return;
      }

      client.last_recv = unix_time();

      const msg = _msg as string;
      arr = msg.split(",");

      const cmd = arr[0];
      const func = proc_ws_map[cmd];
      if (func === undefined) {
        close_ws(client, "message unknown cmd, " + msg);
        return;
      }

      func(client, arr);
    } catch (_e) {
      const e = _e as Error;
      console.error("message_catch", arr, e);

      try {
        close_ws(client, `message_cath:${e.message}`);
      } catch (e2) {
        console.error("message_catch_2", arr, e2);
      }
    }
  });

  client.on("disconnect", (reason) => {
    try {
      close_ws(client, "disconnect:" + reason);
    } catch (e) {
      console.error("disconnect_catch", e);
    }
  });

  // start packet
  var res = new NS_Echo();
  res.text = "open";
  client.send_res(res);
}

// 리턴 false : 연결을 끊는다.
function update_ws(client: WebSocket2): boolean {
  const now = unix_time();
  const delay = now - client.last_update;
  if (delay < 1 + random(4)) return true;

  client.last_update = now;
  // console.log("update_ws", client.index, delay);

  // 할일
  if (client.is_dummy_class) {
    var dummy = client as any;
    on_dummy_update(dummy as DummyClient);
  }

  return true;
}

var cur_update = 0;
var loop_update = 0;
// 일정시간마다 업데이트
export function on_update_client() {
  const now = unix_time();
  var loop_update = client_list.length / 4;
  if (loop_update < 10) loop_update = 10;

  const list_close_recv: number[] = [];
  const list_close_update: number[] = [];
  for (var i = 0; i < loop_update; i++, cur_update++) {
    if (client_list.length < 1) break;

    const cur = cur_update % client_list.length;

    const client = client_list[cur];
    if (client === null) continue;

    // 전송 시간 초과
    if (client.is_dummy_class) {
      // 더미는 시간 초과 없음
    } else if (now - client.last_recv > LIVE_RECV_TIME) {
      list_close_recv.push(client.index);
      continue;
    }

    // 자주 업데이트
    if (false === update_ws(client)) {
      list_close_update.push(client.index);
      continue;
    }
  }

  // 유저제거 recv
  list_close_recv.forEach((i) => {
    const client = client_list[i];
    if (client === null) return;
    close_ws(client, "recv timeout");
  });

  // 유저제거 update
  list_close_update.forEach((i) => {
    const client = client_list[i];
    if (client === null) return;
    close_ws(client, "update close");
  });
}

export async function on_update_waitroot() {
  wait_room.update_match();

  // counter log
  const total = client_list.length;
  const closed = closed_list.length;
  const online = total - closed;

  const data = {
    date: time_format(),
    time: unix_time(),
    url: EXTERNAL_URL,
    online,
    closed,
  };

  const key = redis_key("WS_LIST");
  const text = JSON.stringify(data);
  await get_redis().hset(key, SERVER_NAME, text);
  // console.log("HSET", key, text);
}
