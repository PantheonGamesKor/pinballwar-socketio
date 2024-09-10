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
  NS_Game_Finish,
  GAME_FINISH_DATA,
} from "../types_sock";
import {
  //
  redis_key,
  get_redis,
} from "./myredis";

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
  last_update: number = unix_time();

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
      gold_spend: 0,
      cash_spend: 0,
    };
    client.game_log = [];

    this.user_list.push(client);
  }

  // 주기적으로 방 없데이트
  // 유저 패킷 올때마다 걸러서 체크
  update_room() {
    const now = unix_time();
    const elapse = now - this.last_update;
    if (elapse < 10) return;

    console.log("gameroom update_room", this.game_id, this.user_list.length);
    this.last_update = now;

    if (false == this.game_start) {
      this.check_loading();
    }

    this.check_dummy_only_play();
  }

  // 더미만 있으면 게임 끝낸다.
  check_dummy_only_play() {
    let user_count = 0;
    let dummy_count = 0;
    this.user_list.forEach((v) => {
      if (v.is_dummy) {
        dummy_count++;
      } else {
        user_count++;
      }
    });
    console.log("gameroom check_game_finish", user_count, dummy_count);

    // 유저가 없다면 더미를 끝낸다.
    if (user_count > 0) {
      return;
    }

    // 이방에 모든 유저는 더미
    // console.log("check_game_finish, all user is dummy");

    // 더미 처리
    this.user_list.forEach((dummy) => {
      const res = new NS_Echo();
      res.text = "dummy_game_finish";
      dummy.send_res(res);
    });

    //
    const res = new NS_Game_Finish();
    const res_text = res.to_data();
    this.user_list.forEach((dummy) => {
      dummy.game_room = null;
      dummy.send_text(res_text, res);
    });
    this.user_list = [];

    //
    delete game_room_map[this.game_id];
    console.log("game_close", this.game_id);
  }

  // 유저 나감
  async leave_user(c: WebSocket2) {
    const user_uid = c.user_uid;
    console.log("game_room.leave_user, user_uid=", user_uid);

    const pos = this.user_list.findIndex((v) => {
      return v.user_uid == user_uid;
    });
    if (pos < 0) {
      // 불가능한 상황
      console.error("[ERR] leave_user fail, not found user_uid", user_uid);
      return;
    }

    // 게임방 정보 제거
    c.game_room = null;

    const redis_data: GAME_FINISH_DATA = {
      data: c.game_data,
      logs: c.game_log,
    };
    const game_log_text = JSON.stringify(redis_data);
    console.log("game_log", game_log_text);
    c.game_log = [];

    const key = redis_key("GAME_FINISH");
    get_redis()
      .hset(key, user_uid, game_log_text)
      .then(() => {
        //
      })
      .catch((e) => {
        console.log(
          //
          "leave_user redis_hset fail",
          key,
          user_uid,
          e.message
        );
      });

    const now = unix_time();
    const key_history = redis_key("GAME_FINISH_HISTORY");
    get_redis() //
      .zadd(key_history, now, user_uid)
      .then(() => {
        //
      })
      .catch((e) => {
        console.log(
          "leave_user redis_zadd fail",
          key_history,
          user_uid,
          now,
          e.message
        );
      });

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

    // 더미만 있으면 끝낸다.
    this.check_dummy_only_play();
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
