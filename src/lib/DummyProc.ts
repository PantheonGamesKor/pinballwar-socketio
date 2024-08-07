import {
  to_int,
  unix_time,
  unix_time_ms,
  //
  NetPacket,
  NQ_Echo,
  NS_Echo,
  NQ_Game_Finish,
  NQ_Ready,
  NQ_Login,
  NS_Login,
  NS_Ready,
  NN_Ready_Start,
  NQ_Game_LoadComplete,
  NS_Game_LoadComplete,
  NN_Game_Start,
  NS_Game_Finish,
  NN_Ready_Join,
  NN_Game_Leave,
  NQ_Game_Action,
} from "../types_sock";
import {
  //
  DUMMY_STATE,
  DummyClient,
} from "./DummyClient";
import { set_token } from "./myredis";
import { time_now, random, time_diff_now } from "./helper";

// 자주 업데이트
export function on_dummy_update(dummy: DummyClient) {
  const now = unix_time();
  dummy.update_action_count++;
  // console.log(
  //   "on_dummy_update",
  //   dummy.user_uid,
  //   dummy.update_action_count,
  //   dummy.state
  // );

  if (dummy.next_action < now) {
    if (dummy.state == DUMMY_STATE.IDLE) {
      dummy.next_action = now + random(5);
      // 바로 레디 하지말고 대기자 리스트를 받는다.
      if (dummy.req_wait_room_hint) {
        dummy.next_action = now + 5 + random(5);

        const req = new NQ_Echo();
        req.text = `dummy_wait_room_hint`;
        dummy.send_packet(req);
      }
    } else if (dummy.state == DUMMY_STATE.GAMEROOM) {
      dummy.next_action = now + 5 + random(5);

      // 훼이크 유저라면 빨리 끝낸다.
      if (false === dummy.is_dummy) {
        const diff = time_diff_now(dummy.state_time);
        if (diff < 30) {
          console.log("on_dummy_update GAMEROOM diff=", diff);
        } else {
          console.log("on_dummy_update GAMEROOM diff=", diff);
          const req = new NQ_Game_Finish();
          dummy.send_packet(req);
          return;
        }
      }

      // 여러 액션 처리
      // const seq = update_action_count % 6;
      const seq = random(100);
      if (seq < 5) {
        // 채팅도 보내본다.
        const req = new NQ_Game_Action();
        req.action = NQ_Game_Action.CHAT;
        req.text = `dummy chat ${dummy.update_action_count}`;
        dummy.send_packet(req);
      } else if (seq < 10) {
        // 속성 변경
        const req = new NQ_Game_Action();
        req.action = NQ_Game_Action.CHANGE_ATTR;
        req.value = random(5);
        dummy.send_packet(req);
      } else if (seq < 60) {
        // 공 추가
        const req = new NQ_Game_Action();
        req.action = NQ_Game_Action.BALL_ADD;
        req.value = 10;
        dummy.send_packet(req);
      } else if (seq < 100) {
        // 공 속도 업
        const req = new NQ_Game_Action();
        req.action = NQ_Game_Action.SPEED_UP;
        req.value = 10;
        dummy.send_packet(req);
      }
      // ACTION END
    }
  }

  // if (dummy.req_wait_room_hint) {
  //   const r = random(5);
  //   //   console.log("dummy.req_wait_room_hint", r);
  //   if (r == 0) {
  //     dummy.req_wait_room_hint = false;

  //     // 바로 레디 하지말고 대기자 리스트를 받는다.
  //     const req = new NQ_Echo();
  //     req.text = `dummy_wait_room_hint`;
  //     dummy.send_res(req);
  //   }
  // }

  // if (dummy.game_start) {
  //   // 더미 - 게임중 처리
  //   const now = unix_time();
  //   if (dummy.next_action < now) {
  //     // 다음번 액션 예약
  //     dummy.next_action = now + 5 + random(5);

  //     // 여러 액션 처리
  //     update_action_count++;
  //     const seq = update_action_count % 5;
  //     if (seq % 5 == 0) {
  //       // 채팅도 보내본다.
  //       const req = new NQ_Game_Action();
  //       req.action = NQ_Game_Action.CHAT;
  //       req.text = `test chat ${update_action_count}`;
  //       dummy.send_res(req);
  //     } else {
  //       // 액션 보내기
  //       const req = new NQ_Game_Action();
  //       req.action = NQ_Game_Action.BALL_ADD;
  //       req.value = 1;
  //       dummy.send_res(req);
  //     }
  //   }
  // }

  //   // 접속 유지를 위해 ping 보내기
  //   {
  //     const d = now - dummy.last_send;
  //     if (d > 5) {
  //       var req = new NQ_Echo();
  //       req.text = "ping-" + unix_time_ms();
  //       dummy.send_packet(req);
  //     }
  //   }
}

export async function dummy_recv_NS_Echo(dummy: DummyClient, res: NS_Echo) {
  // console.log("dummy_recv_NS_Echo", res);

  if (res.text == "open") {
    dummy.state = DUMMY_STATE.CONNECTING;
    dummy.state_time = time_now();

    var country = "";
    if (typeof dummy.session.country == "string") {
      country = dummy.session.country;
    }

    // todo 토큰 넣고
    dummy.dummy_token = await set_token({
      user_uid: dummy.dummy_user_uid,
      user_name: `USER-${dummy.dummy_user_uid}`,
      profile_url: "",
      country,
      team: 0,
      start_ch: 0,
      Tinggo_level: 1,
      Firo_level: 1,
      Lighden_level: 1,
      Icing_level: 1,
      Windy_level: 1,
    });

    var req = new NQ_Login();
    req.token = dummy.dummy_token;
    dummy.send_packet(req);
    return;
  }

  if (res.text.indexOf("dummy_wait_room_hint-") == 0) {
    const arr_echo = res.text.split("-");
    const c = arr_echo[1];
    if (c == "null") {
      if (false == dummy.is_dummy) {
        // 유저처럼 행동한다 그냥 들어간다.
        var new_country = dummy.session.country;

        const r = random(5);
        switch (r) {
          case 0:
            new_country = "kor";
            break;
          case 1:
            new_country = "usa";
            break;
          case 2:
            new_country = "jpn";
            break;
          case 3:
            new_country = "chn";
            break;
        }
        dummy.session.country = new_country;
        console.log("dumuser counrty", new_country);

        const req = new NQ_Ready();
        req.country_option = new_country;
        dummy.send_packet(req);
      } else {
        // 대기자 없음, 기다렸다 다시 요청한다.
        dummy.req_wait_room_hint = true;
      }
    } else {
      // 국가 맞춰서 들어간다.
      const req = new NQ_Ready();
      req.country_option = c;
      dummy.send_packet(req);
    }
    return;
  }

  if (res.text.indexOf("dummy_change_country-") == 0) {
    // 더미 국가를 강제로 변경
    const arr_text = res.text.split("-");
    const c = arr_text[1];
    dummy.session.country = c;
    return;
  }

  if (res.text.indexOf("ping-") == 0) {
    // // 시간지연 검사
    // const arr_echo = res.text.split("-");
    // const ms = to_int(arr_echo[1]);
    // const d = unix_time_ms() - ms;
    // if (d > 50) {
    //   console.log("slow ping", d, "ms");
    // }
    return;
  }

  // 게임방에서 나가라
  if (res.text.indexOf("dummy_game_finish") == 0) {
    //if (dummy.state == STATE_GAMEROOM)
    {
      dummy.state = DUMMY_STATE.IDLE;
      dummy.state_time = time_now();
      dummy.game_id = "";
    }
    return;
  }

  console.log("NS_Echo else", res);
}

export function dummy_recv_NS_Login(dummy: DummyClient, res: NS_Login) {
  console.log("dummy_recv_NS_Login", res);

  // 대기자에 맞는 국가로 들어간다.
  dummy.req_wait_room_hint = true;
  dummy.state = DUMMY_STATE.IDLE;
  dummy.state_time = time_now();
  dummy.next_action = unix_time() + random(3);
}

export function dummy_recv_NS_Ready(dummy: DummyClient, res: NS_Ready) {
  console.log("dummy_recv_NS_Ready", res);

  if (res.code == NS_Ready.ENTER) {
    dummy.state = DUMMY_STATE.WAITROOM;
    dummy.state_time = time_now();
  } else {
    dummy.state = DUMMY_STATE.IDLE;
    dummy.state_time = time_now();
  }
}

export function dummy_recv_NN_Ready_Join(
  dummy: DummyClient,
  res: NN_Ready_Join
) {
  //   const res = new NN_Ready_Join();
  //   res.from_data(arr);
}

export function dummy_recv_NN_Ready_Start(
  dummy: DummyClient,
  res: NN_Ready_Start
) {
  //   const res = new NN_Ready_Start();
  //   res.from_data(arr);
  const req = new NQ_Game_LoadComplete();
  dummy.send_packet(req);
}

export function dummy_recv_NS_Game_LoadComplete(
  dummy: DummyClient,
  res: NS_Game_LoadComplete
) {
  //   const res = new NS_Game_LoadComplete();
  //   res.from_data(arr);
}

export function dummy_recv_NN_Game_Start(
  dummy: DummyClient,
  res: NN_Game_Start
) {
  console.log("dummy_recv_NN_Game_Start", res, dummy.session.country);

  dummy.game_start = true;
  dummy.state = DUMMY_STATE.GAMEROOM;
  dummy.state_time = time_now();
  dummy.game_id = res.game_id;
  dummy.next_action = 0;
}

export function dummy_recv_NN_Game_Leave(
  dummy: DummyClient,
  res: NN_Game_Leave
) {
  //   const res = new NN_Game_Leave();
  //   res.from_data(arr);
}

export function dummy_recv_NS_Game_Finish(
  dummy: DummyClient,
  res: NS_Game_Finish
) {
  console.log("dummy_recv_NS_Game_Finish", res);

  dummy.state = DUMMY_STATE.IDLE;
  dummy.state_time = time_now();
  dummy.req_wait_room_hint = true;
}
