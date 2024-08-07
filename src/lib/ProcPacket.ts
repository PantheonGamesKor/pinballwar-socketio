import {
  unix_time,
  //
  WebSocket2,
  //
  NQ_Echo,
  NS_Echo,
  NQ_Login,
  NS_Login,
  NQ_Ready,
  NS_Ready,
  NN_Ready_Start,
  NN_Ready_Join,
  NN_Game_Leave,
  NQ_Game_LoadComplete,
  NS_Game_LoadComplete,
  NN_Game_Start,
  NQ_Game_Action,
  NN_Game_Action,
  NQ_Game_Finish,
  NS_Game_Finish,
} from "../types_sock";
import { close_ws, user_map } from "./ClientManager";
import { game_room_map } from "./GameRoom";
import { wait_room } from "./WaitRoom";
import { get_token } from "./myredis";

// 받은거 처리기
type PROC_WS = (c: WebSocket2, arr: string[]) => void;
type PROC_WS_MAP = {
  [key: string]: PROC_WS;
};
export const proc_ws_map: PROC_WS_MAP = {};

proc_ws_map[NQ_Login.NO] = async (client: WebSocket2, arr: string[]) => {
  const req = new NQ_Login();
  req.from_data(arr);
  // console.log("proc_ws NQ_Login", client.index, req);

  // 로그인 확인 작업
  var data = await get_token(req.token);
  // console.log("get_token", data);
  if (data === null) {
    close_ws(client, "login_fail");
    return;
  }

  const user_uid = data.user_uid;
  client.user_uid = user_uid;
  client.session = data;
  client.game_id = "";
  client.load_complete = false;
  console.log("NQ_Login", client.index, client.session.user_name);

  // 중복로그인 처리
  const other = user_map[user_uid];
  if (other !== undefined) {
    // 있던 유저 잘라냄
    console.log("NetReqLogin NetReqLogin duplicate login");
    close_ws(other, "login_duplicate");
  }

  user_map[client.user_uid] = client;

  // 응답
  const res = new NS_Login();
  res.user_uid = user_uid;
  client.send_res(res);
};
// 연결유지 툥신
proc_ws_map[NQ_Echo.NO] = (client: WebSocket2, arr: string[]) => {
  // 연결 유지를 위해 허용
  // if (client.user_uid == 0) {
  //   // 로그인되었으면 버림
  //   console.log("NQ_Echo user_uid fail");
  //   close_ws(client, "login_duplicate");
  //   return;
  // }

  const req = new NQ_Echo();
  req.from_data(arr);

  if (req.text.length < 1) {
    return;
  }

  const t0 = req.text[0];
  const res = new NS_Echo();
  res.text = req.text;

  if (t0 == "d") {
    if (req.text == "dummy_wait_room_hint") {
      // 가장 오래 기다린 사람 국가 리턴
      const c = wait_room.get_longest_wait_country();
      if (c === null) {
        res.text = "dummy_wait_room_hint-null";
      } else {
        res.text = "dummy_wait_room_hint-" + c;
      }
    }
  }

  client.send_res(res);
};
// 게임 레디
proc_ws_map[NQ_Ready.NO] = (client: WebSocket2, arr: string[]) => {
  // 로그인 해야 쓸 수 있음
  if (client.user_uid == 0) {
    console.log("NQ_Ready login_fail");
    close_ws(client, "login_fail");
    return;
  }

  const req = new NQ_Ready();
  req.from_data(arr);
  console.log("NQ_Ready", client.index, req);

  // 더미 국가 변경옵션
  if (req.country_option != "") {
    client.session.country = req.country_option;
    // client.is_dummy = true;
  }

  const user_uid = client.user_uid;
  if (req.cancel) {
    const b = wait_room.remove(user_uid);
    if (!b) {
      console.log("NQ_Ready cancel fail");
      close_ws(client, "ready_cancel_fail");
      return;
    }

    const res = new NS_Ready();
    res.code = NS_Ready.LEAVE;
    client.send_res(res);
    return;
  }

  // 입장하기
  wait_room.add({
    user_uid,
    client_index: client.index,
    country: client.session.country,
    time: unix_time(),
    is_dummy: client.is_dummy,
  });

  const res = new NS_Ready();
  res.code = NS_Ready.ENTER;
  client.send_res(res);
};
// 게임 레디
proc_ws_map[NQ_Game_LoadComplete.NO] = (client: WebSocket2, arr: string[]) => {
  if (client.game_id == "") {
    // 이럴 수 없는디..
    console.error("[ERR] NQ_Game_LoadComplete fail, game_id is empty");
    close_ws(client, "loadcomplete_fail_1");
    return;
  }

  const game_room = game_room_map[client.game_id];
  if (game_room === undefined) {
    console.error("[ERR] NQ_Game_LoadComplete fail, not found game_room");
    // 타이밍 때문에 이럴 수 있음
    // 끊을 필요 없고
    // close_ws(client, "loadcomplete_fail_2");
    return;
  }

  client.load_complete = true;
  game_room.check_loading();
};
// 게임 액션
proc_ws_map[NQ_Game_Action.NO] = (client: WebSocket2, arr: string[]) => {
  if (client.game_id == "") {
    // 이럴 수 없는디..
    console.error("[ERR] NQ_Game_Action fail, game_id is empty");
    close_ws(client, "game_action_fail_1");
    return;
  }

  const game_room = game_room_map[client.game_id];
  if (game_room === undefined) {
    // 발생가능한 상황
    // console.error("[ERR] NQ_Game_Action fail, not found game_room");
    // close_ws(client, "game_action_fail_2");
    return;
  }

  const req = new NQ_Game_Action();
  req.from_data(arr);
  // console.log("NQ_Game_Action", client.index, req);

  // 숫자 제한 검사
  switch (req.action) {
    case NQ_Game_Action.BALL_ADD:
      if (client.game_data.ball + req.value > 100) {
        req.value = 100 - client.game_data.ball;
      }

      if (req.value <= 0) {
        // 처리하지 않는다.
        return;
      }

      client.game_data.ball += req.value;
      break;
    case NQ_Game_Action.SPEED_UP:
      if (client.game_data.speed + req.value > 100) {
        req.value = 100 - client.game_data.speed;
      }

      if (req.value <= 0) {
        // 처리하지 않는다.
        return;
      }

      client.game_data.speed += req.value;
      break;
    case NQ_Game_Action.CHANGE_ATTR:
      if (client.game_data.attr == req.value) {
        // 동일한 속성으로는 변경 불가
        return;
      }

      client.game_data.attr = req.value;
      break;
  }

  const res = new NN_Game_Action();
  res.user_uid = client.user_uid;
  res.turn = 0;
  res.action = req.action;
  res.value = req.value;
  res.text = req.text;
  game_room.send_res_all(res);
};

// 게임 레디
proc_ws_map[NQ_Game_Finish.NO] = (client: WebSocket2, arr: string[]) => {
  if (client.game_id == "") {
    // 불가능한 상황
    console.error("[ERR] NQ_Game_Finish fail, game_id is empty");
    close_ws(client, "game_finish_fail_1");
    return;
  }

  const game_room = game_room_map[client.game_id];
  if (game_room !== undefined) {
    game_room.leave_user(client.user_uid);
  } else {
    console.error("[ERR] NQ_Game_Finish not found game_room");
  }

  // 상태와 상관없이 나가기 처리
  client.game_id = "";

  const res = new NS_Game_Finish();
  client.send_res(res);
};
