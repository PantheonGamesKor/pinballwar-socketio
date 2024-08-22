import { WebSocket2 } from "../types_sock";
import { game_room_map } from "./GameRoom";
import { wait_room } from "./WaitRoom";

//
export type WebSocket2_Null = WebSocket2 | null;

type UserIndexMap = {
  [key: number]: WebSocket2;
};

//
export const client_list: WebSocket2_Null[] = [];
export const closed_list: number[] = [];
export const user_map: UserIndexMap = {};

// 연결 정리
export function close_ws(client: WebSocket2, reason: string) {
  const index = client.index;
  if (index < 0) {
    // console.log("close_ws alread closed");
    return;
  }

  const user_uid = client.user_uid;
  // const game_id = client.game_id;
  const game_room = client.game_room;
  const game_id = game_room === null ? "" : game_room.game_id;
  console.log("close_ws", index, user_uid, game_id, reason);

  // 대기방에서 나가기
  if (user_uid > 0) {
    // 대기실에서도 나가기
    wait_room.leave(client);
  }

  // 게임방에서 나가기
  // if (game_id != "") {
  //   const game_room = game_room_map[game_id];
  //   client.game_id = "";
  if (game_room !== null) {
    client.game_room = null;

    // console.log("close_ws->game_id", game_id);
    // if (game_room !== undefined)
    {
      game_room.leave_user(client);
      console.log("close -> game_room.leave_user");

      // 빈방이면 제거해야함
      if (game_room.is_empty()) {
        delete game_room_map[game_id];
        console.log("close -> game_room delete");
      }
    }
    // else {
    //   console.error("[ERR] close -> game_room not found");
    // }
  }

  if (user_uid != 0) {
    client.user_uid = 0;
    delete user_map[user_uid];
  }

  // 인덱스 제거
  client_list[index] = null;
  closed_list.push(index);

  client.index = -1; // 중복 처리 막기
  client.disconnect(); // 끊기
}
