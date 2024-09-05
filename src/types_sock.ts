// types_sock.ts
import moment, { Moment } from "moment";
import {
  //
  Server as HttpServer,
  IncomingMessage,
  ServerResponse,
} from "http";
import { TokenData } from "./lib/myredis";

// socket.io
import { Server, Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { GameRoom } from "./lib/GameRoom";

// const
export const MAX_BALL_LV = 200;
export const MAX_SPEED_LV = 200;

// type
export type HttpServer2 = HttpServer<
  //
  typeof IncomingMessage,
  typeof ServerResponse
>;

export const WSServer = Server;
export type WebSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
>;

interface GAME_DATA {
  attr: number;
  ball: number;
  speed: number;
  gold_spend: number;
  cash_spend: number;
}

interface GAME_LOG {
  turn: number;
  score: number;
  ball: number;
  speed: number;
  attr: number;
  gold: number;
  cash: number;
}

// WebSocket2
export interface WebSocket2 extends WebSocket {
  // value
  index: number;
  user_uid: number;
  session: TokenData;
  is_waitroom: boolean; // 대기실에 있는가
  // game_id: string;
  game_room: GameRoom | null;
  load_complete: boolean;
  is_dummy: boolean; // 더미 유저
  is_dummy_class: boolean; // 생성은 더미로 되었다.

  // 게임용 데이터
  game_data: GAME_DATA;
  game_log: GAME_LOG[];

  //
  last_recv: number;
  last_update: number;

  // func
  send_text: (text: string, res: NetPacket) => void; // 더미는 res 를 쓰고 소켓은 text 를 쓴다.
  send_res: (res: NetPacket) => void;
}

//
// 함수
//

//
function args_to_data(...args: any): string {
  var text = "";
  args.forEach((v: any, i: number) => {
    if (i != 0) text += ",";
    text += v;
  });
  return text;
}

// 짧게 줄임
export const to_int = Number.parseInt;

// 초단위
export function unix_time(date = Date.now()): number {
  return Math.floor(date / 1000);
}

export function unix_time_ms(date = Date.now()): number {
  return Math.floor(date);
}

// moment 임포트 하기 귀찮아서
export const time_now = moment;

// 글자로
export function time_format(m: Moment | null = null) {
  if (m === null) {
    m = time_now();
  }

  return m.format("yyyy-MM-DD HH:mm:ss");
}

//
// 패킷
//

export abstract class NetPacket {
  no = 0;

  from_data(arr: string[]) {
    throw new Error("need from_data");
  }
  to_data(): string {
    throw new Error("need to_data");
  }
}

//
export class NQ_Login extends NetPacket {
  static NO = 1;
  no = 1;
  token: string = "";
  //
  from_data(arr: string[]) {
    var i = 1;
    this.token = arr[i++];
  }
  to_data(): string {
    return args_to_data(
      //
      this.no,
      this.token
    );
  }
}
export class NS_Login extends NetPacket {
  static NO = 2;
  no = 2;
  //
  user_uid = 0;
  //
  from_data(arr: string[]) {
    var i = 1;
    this.user_uid = to_int(arr[i++]);
  }
  to_data(): string {
    return args_to_data(
      //
      this.no,
      this.user_uid
    );
  }
}

//
export class NQ_Echo extends NetPacket {
  static NO = 6;
  no = 6;
  text = "";
  //
  from_data(arr: string[]) {
    var i = 1;
    this.text = arr[i++];
  }
  to_data(): string {
    return args_to_data(
      //
      this.no,
      this.text
    );
  }
}
export class NS_Echo extends NetPacket {
  static NO = 7;
  no = 7;
  text = "";
  //
  from_data(arr: string[]) {
    var i = 1;
    this.text = arr[i++];
  }
  to_data(): string {
    return args_to_data(
      //
      this.no,
      this.text
    );
  }
}

// 대기방에 들어갈때
export class NQ_Ready extends NetPacket {
  static NO = 11;
  no = 11;
  cancel: number = 0;
  // country_option: string = ""; // 더미는 국가를 변경해서 들어갈 수 있다.
  //
  from_data(arr: string[]) {
    var i = 1;
    this.cancel = Number.parseInt(arr[i++]);
    // this.country_option = arr[i++];
  }
  to_data(): string {
    return args_to_data(
      //
      this.no,
      this.cancel
      // this.country_option
    );
  }
}
export class NS_Ready extends NetPacket {
  static ENTER = 1;
  static LEAVE = 0;
  static NO = 12;
  no = 12;
  code = 0;
  //
  from_data(arr: string[]) {
    var i = 1;
    this.code = Number.parseInt(arr[i++]);
  }
  to_data(): string {
    return args_to_data(
      //
      this.no,
      this.code
    );
  }
}

//
export class NN_Ready_Join extends NetPacket {
  static NO = 16;
  no = 16;
  user_uid = 0;
  user_name = "";
  team = 0;
  country = "";
  profile_url = "";
  start_ch = 0; // 시작 케릭터 id, eAttribute 값
  Tinggo_level = 0;
  Firo_level = 0;
  Lighden_level = 0;
  Icing_level = 0;
  Windy_level = 0;
  //
  from_data(arr: string[]) {
    var i = 1;
    this.user_uid = to_int(arr[i++]);
    this.user_name = arr[i++];
    this.team = to_int(arr[i++]);
    this.country = arr[i++];
    this.profile_url = arr[i++];
    this.start_ch = to_int(arr[i++]);
    this.Tinggo_level = to_int(arr[i++]);
    this.Firo_level = to_int(arr[i++]);
    this.Lighden_level = to_int(arr[i++]);
    this.Icing_level = to_int(arr[i++]);
    this.Windy_level = to_int(arr[i++]);
  }
  to_data(): string {
    return args_to_data(
      //
      this.no,
      this.user_uid,
      this.user_name,
      this.team,
      this.country,
      this.profile_url,
      this.start_ch,
      this.Tinggo_level,
      this.Firo_level,
      this.Lighden_level,
      this.Icing_level,
      this.Windy_level
    );
  }
}

//
export class NN_Ready_Start {
  static NO = 21;
  no = 21;
  end_turn = 0;
  max_ball_lv = 0;
  max_speed_lv = 0;
  //
  from_data(arr: string[]) {
    var i = 1;
    this.end_turn = to_int(arr[i++]);
    this.max_ball_lv = to_int(arr[i++]);
    this.max_speed_lv = to_int(arr[i++]);
  }
  to_data(): string {
    return args_to_data(
      //
      this.no,
      this.end_turn,
      this.max_ball_lv,
      this.max_speed_lv
    );
  }
}

//
export class NQ_Game_LoadComplete extends NetPacket {
  static NO = 26;
  no = 26;
  //
  from_data(arr: string[]) {
    // var i = 1;
    // this.end_turn = to_int(arr[i++]);
  }
  to_data(): string {
    return args_to_data(
      //
      this.no
      // this.text
    );
  }
}
export class NS_Game_LoadComplete extends NetPacket {
  static NO = 27;
  no = 27;
  //
  from_data(arr: string[]) {
    // var i = 1;
    // this.end_turn = to_int(arr[i++]);
  }
  to_data(): string {
    return args_to_data(
      //
      this.no
    );
  }
}

//
export class NN_Game_Start extends NetPacket {
  static NO = 31;
  no = 31;
  game_id = "";
  //
  from_data(arr: string[]) {
    var i = 1;
    this.game_id = arr[i++];
  }
  to_data(): string {
    return args_to_data(
      //
      this.no,
      this.game_id
    );
  }
}

//
export class NQ_Game_Action extends NetPacket {
  static BALL_ADD = 1;
  static SPEED_UP = 2;
  static CHANGE_ATTR = 3;
  static CHAT = 4;
  static SCORE_UPLOAD = 5; // 내 점수를 전송
  //
  static NO = 36;
  no = 36;
  action = 0;
  value = 0;
  text = "";
  //
  from_data(arr: string[]) {
    var i = 1;
    this.action = to_int(arr[i++]);
    this.value = to_int(arr[i++]);
    this.text = arr[i++];
  }
  to_data(): string {
    return args_to_data(
      //
      this.no,
      this.action,
      this.value,
      this.text
    );
  }
}
export class NN_Game_Action extends NetPacket {
  static NO = 37;
  no = 37;
  user_uid = 0;
  turn = 0;
  action = 0;
  value = 0;
  text = "";
  //
  from_data(arr: string[]) {
    var i = 1;
    this.user_uid = to_int(arr[i++]);
    this.turn = to_int(arr[i++]);
    this.action = to_int(arr[i++]);
    this.value = to_int(arr[i++]);
    this.text = arr[i++];
  }
  to_data(): string {
    return args_to_data(
      //
      this.no,
      this.user_uid,
      this.turn,
      this.action,
      this.value,
      this.text
    );
  }
}

// 게임중 나감
export class NN_Game_Leave {
  static NO = 41;
  no = 41;
  user_uid = 0;
  //
  from_data(arr: string[]) {
    var i = 1;
    this.user_uid = to_int(arr[i++]);
  }
  to_data(): string {
    return args_to_data(
      //
      this.no,
      this.user_uid
    );
  }
}

// 게임 끝났음을 알림, 유저만 더미는 안보냄
export class NQ_Game_Finish {
  static NO = 46;
  no = 46;
  // user_uid = 0;
  //
  from_data(arr: string[]) {
    // var i = 1;
    // this.user_uid = to_int(arr[i++]);
  }
  to_data(): string {
    return args_to_data(
      //
      this.no
      // this.user_uid
    );
  }
}
export class NS_Game_Finish extends NetPacket {
  static NO = 47;
  no = 47;
  //
  from_data(arr: string[]) {
    // var i = 1;
    // this.user_uid = to_int(arr[i++]);
  }
  to_data(): string {
    return args_to_data(
      //
      this.no
      // this.user_uid,
    );
  }
}
