// WaitRoom.ts
import {
  //
  unix_time,
  WebSocket2,
} from "../types_sock";
import {
  //
  client_list,
} from "./ClientManager";
import {
  //
  GameRoom,
  game_room_map,
} from "./GameRoom";
import { random, shuffle_list } from "./helper";
import { can_create_dummy, create_dummy } from "./DummyClient";

export interface WaitUser {
  user_uid: number;
  // client_index: number;
  country: string;
  time: number;
  is_dummy: boolean;
  client: WebSocket2;
}

export interface CountryCount {
  country: string;
  user: number;
  dummy: number;
}

export type CountryCountMap = {
  [key: string]: CountryCount;
};

// 오래기다린 사람 부터
function sort_wait_time(a: WaitUser, b: WaitUser): number {
  if (a.time == b.time) return 0;
  if (a.time > b.time) return 1;
  return -1;
}

// 시간과 uid 로 짧게 만든다.
var unique_id = 0;
export function make_time_uid(): string {
  unique_id++;
  return `${unique_id}`;
}

export class WaitRoom {
  list: WaitUser[] = [];
  last_match = 0;

  log_country_count = 0;
  log_user_count = 0;

  leave(client: WebSocket2): boolean {
    const user_uid = client.user_uid;
    client.is_waitroom = false;

    var i = this.list.findIndex((v) => {
      if (v.user_uid != user_uid) return false;
      return true;
    });
    if (i < 0) {
      // console.log("WaitRoom remove fail", user_uid);
      return false;
    }

    this.list.splice(i, 1);
    console.log("WaitRoom leave ok, left=", this.list.length);
    return true;
  }

  enter(data: WaitUser) {
    const client = data.client;
    if (client.is_waitroom) {
      console.log("[E] already waitroom", data);
      // this.remove(client);
      return;
    }

    this.list.push(data);
    client.is_waitroom = true;

    console.log("WaitRoom add ok", this.list.length);
  }

  // 국가별 사람수
  country_count(): CountryCountMap {
    this.log_country_count = 0;
    this.log_user_count = 0;

    var map: CountryCountMap = {};
    this.list.forEach((v) => {
      if (map[v.country] === undefined) {
        const new_data: CountryCount = {
          country: v.country,
          user: 0,
          dummy: 0,
        };
        map[v.country] = new_data;

        this.log_country_count++;
      }

      const data = map[v.country];
      if (v.is_dummy) {
        data.dummy++;
      } else {
        data.user++;
      }

      this.log_user_count++;
    });

    return map;
  }

  // 가장 오래기다린 유저
  get_longest_wait_user(): WaitUser | null {
    var found: WaitUser | null = null;
    var min = unix_time();

    this.list.forEach((v) => {
      if (v.is_dummy) return; // 더미는 고려 안해도 됨
      if (min < v.time) return;
      min = v.time;
      found = v;
    });

    if (found === null) return null;

    var wait = found as WaitUser;
    return wait;
  }

  // 가장 오래 기단린 유저의 국가
  get_longest_wait_country(): string | null {
    const wait = this.get_longest_wait_user();
    if (wait === null) return null;

    var c = wait.country;
    return c;
  }

  // 국가별 사람 얻기 / 오래기다린 순으로 정렬됨
  get_country_user(c: string): WaitUser[] {
    const users: WaitUser[] = [];
    this.list.forEach((v) => {
      if (v.country != c) return;
      users.push(v);
    });
    users.sort(sort_wait_time);
    return users;
  }

  // 적당한 대기자 게임시작 시기키
  // 리턴 true : 게임하나 생성했다.
  update_match(): boolean {
    // 아무도 없으면 바로 나간다.
    if (this.list.length < 1) {
      return false;
    }

    const now = unix_time();

    // 시작 가능한 최소 인원
    const MIN_START_USER = 5;

    // 한국가에 5명 넘는 경우 시작한다.
    const map = this.country_count();
    const count_list: CountryCount[] = [];
    var user_count = 0;
    for (const country in map) {
      var cc = map[country];
      user_count += cc.user;
      // if (cc.user < 1) continue; // 더미만 있는 국가 허용
      if (cc.user + cc.dummy < MIN_START_USER) continue;
      count_list.push(cc);
    }

    // 사람 없으면 패스
    if (user_count == 0) {
      return false;
    }

    //
    if (count_list.length >= 2) {
      // 2~4 팀으로 시작
      var team_count = 2;
      if (count_list.length >= 4) {
        team_count = 4;
      } else if (count_list.length >= 3) {
        team_count = 3;
      }

      console.log("update_match start, team=", team_count, count_list);

      const country_list: string[] = [];
      const user_list_list: WaitUser[][] = [];
      var min_count = 10;
      for (var i = 0; i < team_count; i++) {
        const c = count_list[i].country;
        country_list.push(c);

        const user_list = this.get_country_user(c);
        user_list_list.push(user_list);
        if (min_count > user_list.length) {
          min_count = user_list.length;
        }
      }
      console.log("country_list", country_list);
      console.log("min_count", min_count);

      if (min_count > 10) min_count = 10;

      // 각 유저들중에 min_count 만큼 모아서 게임시작
      const start_list: WaitUser[] = [];

      user_list_list.forEach((u1_list) => {
        u1_list.findIndex((v, i: number) => {
          start_list.push(v);

          const c = v.client;
          c.session.team = 1;

          return i == min_count;
        });
      });

      // 대기실에서 나온다.
      start_list.forEach((v) => {
        this.leave(v.client);
      });

      // 시작 시간
      this.last_match = now;

      // 게임시작
      const game_id = make_time_uid();
      const game_room = new GameRoom(game_id);
      game_room_map[game_id] = game_room;

      // 게임방에 유저 입장
      start_list.forEach((v) => {
        const client = v.client;
        game_room.add_user(client);
      });

      //
      game_room.print_log();

      // 게임방 정보 전송
      game_room.send_start();
      return true;
    }

    // 가장 오래기다린 유저를 찾는다.
    const wait_user = this.get_longest_wait_user();
    if (wait_user === null) {
      // 사암이 없다. 아무일도 일어나지 않음
      // console.log("update_match not found user");
      return false;
    }

    // 게임방을 만들 수 없어 기다린다.
    console.log("update_match wait", map, count_list.length);

    // 가장 오래기다린 유저를 포함해 국가 4개를 만든다.
    const MAX_TEAM = 4;
    const cand_list = [wait_user.country];
    for (let i in this.list) {
      const v = this.list[i];
      if (cand_list.length >= MAX_TEAM) break;

      // 더미 국가는 제외
      if (v.is_dummy) continue;
      // 이미 있는 국가는 제외
      const pos = cand_list.indexOf(v.country);
      if (pos >= 0) continue;

      cand_list.push(v.country);
    }

    // 여기까지 와도 국가가 부족하면 랜덤으로 채운다.
    make_random_country(cand_list, MAX_TEAM);
    console.log("update_match wait,  cand_list=", cand_list);

    // 유저 수만 뽑아낸다.
    const cc_list: CountryCount[] = [];
    cand_list.forEach((c) => {
      var cc: CountryCount | null = null;
      for (var i = 0; i < count_list.length; i++) {
        const cc2 = count_list[i];
        if (cc2.country != c) continue;
        cc = cc2;
        break;
      }

      // 사람 없는 국가
      if (cc === null) {
        cc_list.push({
          country: c,
          dummy: 0,
          user: 0,
        });
        return;
      }

      // 있으면 사람 정보만 사용
      cc_list.push({
        country: c,
        dummy: 0,
        user: cc.user,
      });
    });
    console.log("update_match wait, cc_list=", cc_list);

    // 더미 리스트 만들기
    const dummy_list: WaitUser[] = [];
    this.list.forEach((d) => {
      if (false === d.is_dummy) return;
      dummy_list.push(d);
    });

    // 더미를 뽑아서 배치한다.
    let no_more_dummy = false;
    for (const k in cc_list) {
      const cc = cc_list[k];
      const count = cc.user + cc.dummy;

      // 빈자리 채워넣기
      for (let i = count; i < MIN_START_USER; i++) {
        if (dummy_list.length > 1) {
          // 더미 있으면 뽑아쓰고
          const wait_dummy = dummy_list[0];
          dummy_list.splice(0, 1);

          wait_dummy.country = cc.country;

          const dummy = wait_dummy.client;
          dummy.session.country = cc.country;
          cc.dummy++;
        } else {
          // 더미 없으면 만들어 쓰고
          if (false == can_create_dummy()) {
            // 더미 제공 불가
            no_more_dummy = true;
            break;
          }

          // 더미 생성한다.
          const dummy = create_dummy();
          if (dummy === null) {
            no_more_dummy = true;
            break;
          }

          // 로그인 부터 진행, 국가 설정은 무의미하다.
          // dummy.session.country = cc.country;
          cc.dummy++;
        }
      }
    }

    // 에러 로그는 한번만 출력
    if (no_more_dummy) {
      console.log("update_match wait, no_more_dummy");
    }

    return false;
  }
}

// 랜덤 국가로 채운다.
// 겹치지 않게
export function make_random_country(list: string[], count: number) {
  const candidate_list: string[] = [
    "kor",
    "usa",
    "chn",
    "jpn",
    "pol",
    "tur",
    "arm",
    "jam",
    "lux",
    "bel",
    "ggy",
    "mdg",
    "uzb",
    "yem",
    "vnm",
  ];

  // 겹치는거 제거
  list.forEach((d) => {
    for (var i = 0; i < candidate_list.length; i++) {
      const c = candidate_list[i];
      if (c != d) continue;
      candidate_list.splice(i, 1);
      // console.log("remove", c);
      break;
    }
  });

  // 랜덤 추가
  for (var i = list.length; i < count; i++) {
    const r = random(candidate_list.length);
    const c = candidate_list[r];
    candidate_list.splice(r, 1);

    list.push(c);
  }

  // for (var i = 0; i < candidate_list.length; i++) {
  //   const r = random(candidate_list.length);
  //   const c = candidate_list[r];
  //   candidate_list.splice(r, 1);
  //   candidate_list.push(c);
  // }

  // for (var i = 0; i < candidate_list.length; i++) {
  //   if (list.length >= count) break;

  //   // 있으면 안됨
  //   const c = candidate_list[i];
  //   const pos = list.indexOf(c);
  //   if (pos >= 0) continue;

  //   list.push(c);
  // }
}

export const wait_room = new WaitRoom();
