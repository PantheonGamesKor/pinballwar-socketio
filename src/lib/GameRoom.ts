// GameRoom.ts
import {
  //
  unix_time,
  //
  WebSocket2,
  //
  NetPacket,
  NS_Echo,
  NN_Game_Leave,
  NN_Ready_Join,
  NN_Ready_Start,
  NN_Game_Start,
  MAX_BALL_LV,
  MAX_SPEED_LV,
} from "../types_sock";

type CountryTeamMap = {
  [country: string]: number;
};

// 게임방 리스트
export class GameRoom {
  time_create: number = unix_time();
  game_id: string;
  game_start: boolean = false;
  user_list: WebSocket2[] = [];
  team_id_max: number = 0;
  country_team_map: CountryTeamMap = {};

  constructor(game_id: string) {
    this.game_id = game_id;
  }

  // 팀 결정됨
  add_user(client: WebSocket2) {
    const country = client.session.country;
    var team_id = this.country_team_map[country];
    if (team_id === undefined) {
      this.team_id_max++;
      team_id = this.team_id_max;
      this.country_team_map[country] = team_id;
    }

    client.session.team = team_id;
    // client.game_id = this.game_id;
    client.game_room = this;
    client.game_data = {
      attr: client.session.start_ch,
      ball: 1,
      speed: 1,
    };

    this.user_list.push(client);
  }

  // 게임 끝내기
  check_game_finish() {
    // 모든 유저가 나갔다면 더미를 끝낸다.
    let user_count = 0;
    let dummy_count = 0;
    this.user_list.forEach((v) => {
      if (v.is_dummy) {
        dummy_count++;
      } else {
        user_count++;
      }
    });
    console.log("check_game_finish", user_count, dummy_count);

    // 유저가 없다면 더미를 끝낸다.
    if (user_count > 0) {
      return;
    }

    // 이방에 모든 유저는 더미
    console.log("check_game_finish, all dummy, game close");

    // 더미 처리
    this.user_list.forEach((dummy) => {
      const res = new NS_Echo();
      res.text = "dummy_game_finish";
      dummy.send_res(res);
    });

    //
    this.user_list = [];
    this.user_list.forEach((dummy) => {
      // dummy.game_id = "";
      dummy.game_room = null;
    });

    delete game_room_map[this.game_id];
    console.log("game close", this.game_id);
  }

  // 유저 나감
  leave_user(c: WebSocket2) {
    const user_uid = c.user_uid;
    console.log("game_room.leave_user, user_uid=", user_uid);

    const pos = this.user_list.findIndex((v) => {
      return v.user_uid == user_uid;
    });
    if (pos < 0) {
      // 불가능한 상황 심각하다.
      console.error("[ERR] leave_user fail, not found user_uid", user_uid);
      return;
    }

    // 게임방 정보 제거
    // const c = this.user_list[pos];
    // c.game_id = "";
    c.game_room = null;

    // 유저 제거
    this.user_list.splice(pos, 1);

    // 유저랑 더미수 확인
    var user_count = 0;
    this.user_list.forEach((c) => {
      if (c.is_dummy) return;
      user_count++;
    });

    // 다른 유저 나갔다고 알림
    if (user_count > 0) {
      const res = new NN_Game_Leave();
      res.user_uid = user_uid;
      const res_text = res.to_data();
      this.user_list.forEach((c) => {
        c.send_text(res_text, res);
      });
    }

    // 사람이 한명 줄어서 로딩 완료 일 수도 있다.
    if (false == this.game_start) {
      this.check_loading();
    }

    // 끝났을 수도 있다.
    this.check_game_finish();
  }

  // 빈방인가
  is_empty() {
    return this.user_list.length < 1;
  }

  // 방안의 모두에게 패킷 전송
  send_res_all(res: NetPacket) {
    const res_text = res.to_data();
    this.user_list.forEach((u) => {
      u.send_text(res_text, res);
    });
  }

  // 게임방 상태 로그 찍기
  print_log() {
    interface TeamLog {
      country: string;
      user_count: number;
      dummy_count: number;
    }
    type TeamLogMap = {
      [team: number]: TeamLog;
    };

    const map: TeamLogMap = {};
    this.user_list.forEach((c) => {
      //
      if (map[c.session.team] === undefined) {
        const td: TeamLog = {
          country: c.session.country,
          user_count: 0,
          dummy_count: 0,
        };
        map[c.session.team] = td;
      }

      const td = map[c.session.team];
      if (c.is_dummy) {
        td.dummy_count++;
      } else {
        td.user_count++;
      }
    });

    console.log("game_room print_log", this.game_id, map);
  }

  // 게임시작 패킷 전송
  send_start() {
    // u 의 정보를 모든 c 에게 전달
    this.user_list.forEach((u) => {
      const res = new NN_Ready_Join();
      res.user_uid = u.user_uid;
      res.user_name = u.session.user_name;
      res.team = u.session.team;
      res.country = u.session.country;
      res.profile_url = u.session.profile_url;
      res.start_ch = u.session.start_ch;
      res.Tinggo_level = u.session.Tinggo_level;
      res.Firo_level = u.session.Firo_level;
      res.Lighden_level = u.session.Lighden_level;
      res.Icing_level = u.session.Icing_level;
      res.Windy_level = u.session.Windy_level;
      const res_text = res.to_data();
      this.user_list.forEach((c) => {
        c.send_text(res_text, res);
      });
    });

    // 모든 사람에게 시작 패킷
    {
      const res = new NN_Ready_Start();
      res.end_turn = 50 * 60 * 5; // 5분
      res.max_ball_lv = MAX_BALL_LV;
      res.max_speed_lv = MAX_SPEED_LV;
      const res_text = res.to_data();
      this.user_list.forEach((c) => {
        c.send_text(res_text, res);
      });
    }
  }

  // 모두 레디 했으면 게임시작
  check_loading() {
    var not_ready_count = 0;
    this.user_list.forEach((c) => {
      if (c.load_complete) return;
      not_ready_count++;
    });

    if (not_ready_count > 0) {
      // console.log(
      //   "check_loading not yet",
      //   not_ready_count,
      //   "/",
      //   this.user_list.length
      // );
      var res = new NS_Echo();
      res.text = `nr=${not_ready_count}`;
      const res_text = res.to_data();
      this.user_list.forEach((c) => {
        c.send_text(res_text, res);
      });
      return;
    }

    console.log("check_loading ok");
    this.game_start = true;

    // 모든 유저에게 게임 시작 전달
    {
      const res = new NN_Game_Start();
      res.game_id = this.game_id;
      const res_text = res.to_data();
      this.user_list.forEach((c) => {
        c.send_text(res_text, res);
      });
    }
  }
}

// 게임방 여러개
type GameRoomMap = {
  [game_id: string]: GameRoom;
};

// 게임방 여러개 변수
export const game_room_map: GameRoomMap = {};
