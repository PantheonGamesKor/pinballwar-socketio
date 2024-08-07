// DummyClient.ts
import moment from "moment";
import {
  unix_time,
  //
  WebSocket,
  WebSocket2,
  //
  NetPacket,
  NS_Echo,
  NS_Login,
  NS_Ready,
  NN_Ready_Join,
  NN_Ready_Start,
  NS_Game_LoadComplete,
  NN_Game_Start,
  NN_Game_Action,
  NN_Game_Leave,
  NS_Game_Finish,
} from "../types_sock";
import {
  //
  dummy_recv_NS_Echo,
  dummy_recv_NS_Login,
  dummy_recv_NS_Ready,
  dummy_recv_NN_Ready_Join,
  dummy_recv_NN_Ready_Start,
  dummy_recv_NS_Game_LoadComplete,
  dummy_recv_NN_Game_Start,
  dummy_recv_NN_Game_Leave,
  dummy_recv_NS_Game_Finish,
} from "./DummyProc";
import { close_ws } from "./ClientManager";
import {
  //
  TokenData,
} from "./myredis";
import {
  //
  on_connection,
} from "../ws";

interface DummyData {
  user_uid: number;
  country: string;
}

type FUNC_MSG = (msg: string) => void;

export enum DUMMY_STATE {
  OFFLINE = 0,
  CONNECTING = 1,
  IDLE = 2,
  WAITROOM = 3,
  GAMEROOM = 4,
  // GAMEROOM_LEAVE = 5,
}

export class DummyClient {
  // dummy value
  dummy_user_uid = 0;
  dummy_on_message: FUNC_MSG = () => {};
  dummy_token = "";
  req_wait_room_hint = false;
  state = DUMMY_STATE.OFFLINE;
  state_time = moment();
  next_action = 0;
  game_start = false;
  update_action_count = 0;

  // client value
  index = -1;
  user_uid = 0;
  session = {} as TokenData;
  game_id = "";
  load_complete = false;
  is_dummy = true;
  is_dummy_class = false;

  // 게임용 데이터
  game_data = {
    attr: 0,
    ball: 0,
    speed: 0,
  };

  //
  last_recv = unix_time();
  last_update = unix_time();

  //
  send_text(_msg: string, res: NetPacket) {
    this.send_dummy_proc(res);
  }
  send_res(res: NetPacket) {
    this.send_dummy_proc(res);
  }
  disconnect() {
    if (this.index < 0) return;
    var client: any = this;
    close_ws(client as WebSocket2, "disconnect-dummy");
  }
  on(action: string, func: FUNC_MSG) {
    if (action == "message") {
      this.dummy_on_message = func;
    }
  }

  // 더미용 함수
  send_packet(req: NetPacket) {
    const text = req.to_data();
    this.dummy_on_message(text);
  }

  // server -> dummy
  send_dummy_proc(res: NetPacket) {
    switch (res.no) {
      case NS_Echo.NO:
        dummy_recv_NS_Echo(this, res as NS_Echo);
        break;
      case NS_Login.NO:
        dummy_recv_NS_Login(this, res as NS_Login);
        break;
      case NS_Ready.NO:
        dummy_recv_NS_Ready(this, res as NS_Ready);
        break;
      case NN_Ready_Join.NO:
        dummy_recv_NN_Ready_Join(this, res as NN_Ready_Join);
        break;
      case NN_Ready_Start.NO:
        dummy_recv_NN_Ready_Start(this, res as NN_Ready_Start);
        break;
      case NS_Game_LoadComplete.NO:
        dummy_recv_NS_Game_LoadComplete(this, res as NS_Game_LoadComplete);
        break;
      case NN_Game_Start.NO:
        dummy_recv_NN_Game_Start(this, res as NN_Game_Start);
        break;
      case NN_Game_Leave.NO:
        // 할일없음
        break;
      case NN_Game_Action.NO:
        // 할일없음
        break;
      case NS_Game_Finish.NO:
        dummy_recv_NS_Game_Finish(this, res as NS_Game_Finish);
        break;
      default:
        console.error("[E] send_dummy_proc unknown packet", res);
    }
  }

  // dummy -> server
  recv_dummy_proc(req: NetPacket) {
    const text = req.to_data();
    this.dummy_on_message(text);
  }
}

// 시작 더미 번호
var start_dummy_user_uid = 0;

// dummy 생성
export function create_dummy(): DummyClient | null {
  // 더미 제공에 한계 부여
  if (start_dummy_user_uid > 999) {
    console.log("create_dummy fail, count over", start_dummy_user_uid);
    return null;
  }

  start_dummy_user_uid++;

  var dummy = new DummyClient();
  dummy.dummy_user_uid = start_dummy_user_uid;
  dummy.is_dummy = true;
  dummy.is_dummy_class = true;

  var c: any = dummy;
  on_connection(c as WebSocket);

  return dummy;
}

// 더미 훼이크 유저
export function create_fake_user() {
  var dumuser = new DummyClient();
  dumuser.dummy_user_uid = 1001;
  dumuser.is_dummy = false;
  dumuser.is_dummy_class = true;
  var c: any = dumuser;
  on_connection(c as WebSocket);
}
