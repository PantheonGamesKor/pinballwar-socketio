import moment, { Moment } from "moment";
import { unix_time as unix_time_2 } from "../types_sock";
const { v4 } = require("uuid");

import dotenv from "dotenv";
dotenv.config();

export const REDIS_H = process.env.REDIS_H as string;
export const SERVER_NAME = process.env.SERVER_NAME as string;
export const EXTERNAL_URL = process.env.EXTERNAL_URL as string;

// 유니크 시작 번호
let unique_id = 0;

// me : 밀리초
export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 고유번호 얻기2
export function make_uuid(): string {
  unique_id++;
  return v4() + "-" + unique_id;
}

export const unix_time = unix_time_2;

//
export function get_config() {
  return JSON.parse(process.env.CONFIG as string);
}

// 0 ~ max-1 까지만 나옴
export function random(max: number): number {
  var n = Math.floor(Math.random() * max);
  return n;
}

// 섞기
export function shuffle_list(list: any[]) {
  for (var i = 0; i < list.length; i++) {
    const r = random(list.length);
    const c = list[r];
    list.splice(r, 1);
    list.push(c);
  }
}

// old 가 now 보다 과거라면 양수 미래라면 음수가 리턴덴되ㅏ.
// 단위는 밀리초
export function time_diff(now: Moment, old: Moment) {
  return now.diff(old);
}

// 현재에서 얼마 차이나는가
// old 가 과거라면 양수
export function time_diff_now(old: Moment) {
  const now = moment();
  var sec = now.diff(old) / 1000;
  return Math.floor(sec);
}

export function time_now() {
  return moment();
}
