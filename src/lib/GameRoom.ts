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
} from "../types_sock";

type CountryTeamMap = {
  [country: string]: number;
};

// 게임방 리스트
export class GameRoom {
  time_create: number = unix_time();
  game_id: string;
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
    client.game_id = this.game_id;
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
    console.log("game_room.check_game_finish", user_count, dummy_count);

    // 유저가 없다면 더미를 끝낸다.
    if (user_count == 0) {
      console.log("game_room.check_game_finish finish all dummy");

      this.user_list.forEach((v) => {
        const res = new NS_Echo();
        res.text = "dummy_game_finish";
        v.send_res(res);
      });
    } else {
      // 게임 종료 처리
      console.log("game_finish user exists, user_count=", user_count);
    }
  }

  // 유저 나감
  leave_user(user_uid: number) {
    console.log("game_room.leave_user, user_uid=", user_uid);

    const pos = this.user_list.findIndex((v) => {
      return v.user_uid == user_uid;
    });
    if (pos < 0) {
      // 이러면 유저 관리 문제
      console.error("[ERR] leave_user fail, not found user_uid", user_uid);
      return;
    }

    // 게임방 정보 제거
    const c = this.user_list[pos];
    c.game_id = "";

    // 유저 제거
    this.user_list.splice(pos, 1);

    // 다른 유저에게 알림 통신
    this.user_list.forEach((c) => {
      const res = new NN_Game_Leave();
      res.user_uid = user_uid;
      c.send_res(res);
    });

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
    this.user_list.forEach((c) => {
      // c 에게 모든사람 정보를 한번에 join 전달
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
        c.send_res(res);
      });
    });

    // 모든 사람에게 시작 패킷
    {
      const res = new NN_Ready_Start();
      res.end_turn = 50 * 60; // 1분
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
      console.log(
        "check_loading not yet",
        not_ready_count,
        "/",
        this.user_list.length
      );
      return;
    }

    console.log("check_loading ok");

    const res = new NN_Game_Start();
    res.game_id = this.game_id;
    const res_text = res.to_data();
    this.user_list.forEach((c) => {
      c.send_text(res_text, res);
    });
  }
}

// 게임방 여러개
type GameRoomMap = {
  [game_id: string]: GameRoom;
};

// 게임방 여러개 변수
export const game_room_map: GameRoomMap = {};
