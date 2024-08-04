import {
  //
  unix_time,
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

export interface WaitUser {
  user_uid: number;
  client_index: number;
  country: string;
  time: number;
  is_dummy: boolean;
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

  remove(user_uid: number): boolean {
    var i = this.list.findIndex((v) => {
      if (v.user_uid != user_uid) return false;
      return true;
    });
    if (i < 0) {
      // console.log("WaitRoom remove fail", user_uid);
      return false;
    }

    this.list.splice(i, 1);
    console.log("WaitRoom remove ok", this.list.length);
    return true;
  }

  add(data: WaitUser) {
    this.remove(data.user_uid);

    this.list.push(data);

    console.log("WaitRoom add ok", this.list.length);

    // const map = this.country_count();
    // console.log("WaitRoom map", map);
  }

  // 국가별 사람수
  country_count(): CountryCountMap {
    var map: CountryCountMap = {};
    this.list.forEach((v) => {
      if (map[v.country] === undefined) {
        const new_data: CountryCount = {
          country: v.country,
          user: 0,
          dummy: 0,
        };
        map[v.country] = new_data;
      }

      var data = map[v.country];
      if (v.is_dummy) {
        data.dummy++;
      } else {
        data.user++;
      }
    });
    return map;
  }

  // 가장 오래 기단린 유저의 국가
  get_longest_wait_country(): string | null {
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

    // 한국가에 5명 넘는 경우 시작한다.
    const map = this.country_count();
    const count_list: CountryCount[] = [];
    var user_count = 0;
    for (const country in map) {
      var cc = map[country];
      user_count += cc.user;
      // if (cc.user < 1) continue; // 더미만 있는 국가 허용
      if (cc.user + cc.dummy < 5) continue;
      count_list.push(cc);
    }

    // 사람없으면 패스
    if (user_count == 0) {
      return false;
    }

    console.log("update_match", map, count_list.length);

    if (count_list.length >= 2) {
      // 2~4 팀으로 시작
      var team_count = 2;
      if (count_list.length >= 4) {
        team_count = 4;
      } else if (count_list.length >= 3) {
        team_count = 3;
      }

      console.log("update_match count=", team_count, count_list);

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
          const c = client_list[v.client_index];
          if (c !== null) {
            c.session.team = 1;
          }
          return i == min_count;
        });
      });

      // 대기자에서 빼낸다.
      start_list.forEach((v) => {
        this.remove(v.user_uid);
      });

      // 시작 시간
      this.last_match = now;

      // 게임시작
      const game_id = make_time_uid();
      const game_room = new GameRoom(game_id);
      game_room_map[game_id] = game_room;

      // 게임방에 유저 입장
      start_list.forEach((v) => {
        const client = client_list[v.client_index];
        if (client === null) {
          // 없는 client 가 발생했다면 소켓 관리 방식에 문제가 있는거다.
          console.error("[ERR] game start skip, client is numm", v);
          return;
        }
        game_room.add_user(client);
      });

      game_room.print_log();

      // 게임방 정보 전송
      game_room.send_start();
      return true;
    }
    // else if (count_list.length == 1) {
    //   console.log("update_match, country is 1");

    //   // 국가가 하나일 경우 더미의 반을 다른 국가로 옴ㄹ긴다.
    //   const user_list_list: WaitUser[][] = [];
    //   const cc = count_list[0];
    //   if (cc.user + cc.dummy < 10) {
    //     // 사람이 없어서 기다려야함
    //     return false;
    //   }

    //   const c = cc.country;
    //   const user_list = this.get_country_user(c);
    //   const dummy_list: WaitUser[] = [];
    //   user_list.forEach((v) => {
    //     if (v.is_dummy) {
    //       dummy_list.push(v);
    //     }
    //   });

    //   // 절반은 다른 국가로 변경
    //   const c2 = c != "usa" ? "usa" : "chn";
    //   const u_count = user_list.length;
    //   const u_half = Math.floor(u_count / 2);
    //   const d_count = dummy_list.length;
    //   console.log(`update_match type=1, user=${u_count}, dummy=${d_count}`);

    //   // 더미를 u_half 만큼 c2 국가로 변경
    //   dummy_list.forEach((d, i) => {
    //     if (i >= u_half) return;

    //     const client = client_list[d.client_index];
    //     if (client === null) return;
    //     // 국가 강제 변경
    //     const old_country = d.country;
    //     console.log(
    //       `dummy change country, ${old_country}, dummy=${d_count} -> ${c2}`
    //     );

    //     d.country = c2;
    //     client.session.country = c2;

    //     // // 더미가 처리할 일이 없다 전송안해도 될듯
    //     // const res = new NS_Echo();
    //     // res.text = `dummy_change_country-${c2}`;
    //     // send_res(client, res);
    //   });

    //   return true;
    // }

    console.log("update_match, make 2 team");

    // 사람이 너무 적어 시작할 수 없는 경우
    // 분산된 더미를 몰어넣음
    count_list.splice(0, count_list.length);
    for (const country in map) {
      var cc = map[country];
      // if (cc.user < 1) continue; // 더미만 있는 국가 허용
      // if (cc.user + cc.dummy < 5) continue;
      count_list.push(cc);
    }

    // 가장 오래기다린 유저를 찾는다.
    let found_old_user: WaitUser | null = null;
    this.list.forEach((v) => {
      if (v.is_dummy) return;
      if (found_old_user == null) {
        found_old_user = v;
        return;
      }

      if (v.time >= found_old_user.time) return;
      found_old_user = v;
    });

    // 사암은 없었다.
    if (found_old_user === null) {
      console.log("update_match, not found user");
      return false;
    }

    // console.log("found_user", found_old_user);

    // 유저 발견
    const old_user = found_old_user as WaitUser;
    // console.log("update_match, make 2 team, old_user", old_user.user_uid);

    const wait_user = old_user;
    const c1 = wait_user.country; // 첫번째 국가
    var c2 = c1 != "usa" ? "usa" : "chn";

    // 두번째 국가 찾기
    var max_count = 0;
    count_list.forEach((v) => {
      if (v.country == c1) return;
      if (v.user + v.dummy < max_count) return;
      max_count = v.user + v.dummy;
      c2 = v.country;
    });

    // 더미와 유저수를 구함
    var c1_user = 0;
    var c1_dummy = 0;
    var c2_user = 0;
    var c2_dummy = 0;
    var total_dummy = 0;
    count_list.forEach((v) => {
      total_dummy += v.dummy;
      if (v.country == c1) {
        c1_dummy = v.dummy;
        c1_user = v.user;
      }
      if (v.country == c2) {
        c2_dummy = v.dummy;
        c2_user = v.user;
      }
    });

    // 로그
    console.log(
      "c1",
      {
        //
        country: c1,
        user: c1_user,
        dummy: c1_dummy,
      },
      "c2",
      {
        //
        country: c2,
        user: c2_user,
        dummy: c2_dummy,
      },
      "total_dummy",
      total_dummy
    );

    // half 만큼 더미를 옮김
    const total = c1_user + c2_user + total_dummy;
    const half = Math.floor(total / 2);
    var c1_total = c1_user + c1_dummy;
    var c2_total = c2_user + c2_dummy;
    this.list.forEach((v) => {
      if (v.is_dummy == false) return;

      const client = client_list[v.client_index];
      if (client === null) return;

      // c1 c2 는 half 보다 높다면 상대 팀으로 이동시킨다.
      if (v.country == c1) {
        // half 보다 많고
        // c2 보다도 많을때
        if (c1_total > half && c1_total > c2_total) {
          c1_total--;
          c2_total++;

          v.country = c2;
          client.session.country = c2;

          console.log(
            "dummy move, c1 -> c2",
            client.session.user_name,
            client.session.country,
            c1_total,
            "->",
            c2_total
          );
        }
        return;
      } else if (v.country == c2) {
        // half 보다 많고
        // c1 보다도 많을때
        if (c2_total > half && c2_total > c1_total) {
          c2_total--;
          c1_total++;

          v.country = c1;
          client.session.country = c1;

          console.log(
            "dummy move, c1 <- c2",
            client.session.user_name,
            client.session.country,
            c1_total,
            "<-",
            c2_total
          );
        }
        return;
      }

      // 남은 더미는 c1 이나 c2 로 간다..
      var c_target = "";
      if (c1_total < half) {
        c1_total++;
        c_target = c1;
      } else if (c2_total <= half) {
        c2_total++;
        c_target = c2;
      } else {
        return;
      }

      const old_country = v.country;
      console.log(
        //
        "dummy change country",
        client.session.user_name,
        old_country,
        "->",
        c_target
      );

      v.country = c_target;
      client.session.country = c_target;
    });

    return false;
  }
}
export const wait_room = new WaitRoom();
