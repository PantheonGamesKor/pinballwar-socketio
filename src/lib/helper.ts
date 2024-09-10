import moment, { Moment } from "moment";
import dotenv from "dotenv";

import { to_int, unix_time as unix_time_2 } from "../types_sock";
import { word_list } from "./words";

const { v4 } = require("uuid");

dotenv.config();

export const REDIS_H = process.env.REDIS_H as string;
export const SERVER_NAME = process.env.SERVER_NAME as string;
export const EXTERNAL_URL = process.env.EXTERNAL_URL as string;
export const MAX_DUMMY = to_int(process.env.MAX_DUMMY as string);
export const IS_DEV = to_bool(process.env.IS_DEV);
console.log("REDIS_H", REDIS_H);
console.log("SERVER_NAME", SERVER_NAME);
console.log("EXTERNAL_URL", EXTERNAL_URL);
console.log("MAX_DUMMY", MAX_DUMMY);

let AI_NONE = false;
if (IS_DEV) {
  AI_NONE = to_bool(process.env.IS_DEV_AI_NONE);
}
export const IS_DEV_AI_NONE = AI_NONE;

if (IS_DEV) {
  console.log("IS_DEV");
  console.log("IS_DEV_AI_NONE", IS_DEV_AI_NONE);
}

// 유니크 시작 번호
let unique_id = 0;

// me : 밀리초
export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// bool 변환
export function to_bool(v: any): boolean {
  if (v === undefined) return false;
  if (v == "") return false;
  if (v == "0") return false;
  if (v == "false") return false;
  if (v == 0) return false;
  if (v == false) return false;
  return true;
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

// 단어만 뽑기
export function make_random_name() {
  const wi = random(word_list.length);
  const word = word_list[wi];
  return word;
}

// 좀더 섞어서 만듬
export function make_random_user_name(): string {
  let no = random(10000);
  let word = make_random_name();
  switch (random(8)) {
    case 0:
      return `${word}${no}`;
    case 1:
      let no2 = random(10000);
      return `U${no}${no2}`;
    case 2:
      return `U_${word}`;
    case 3:
      let WORD = word.toUpperCase();
      return `USER-${WORD}`;
    case 3:
      return `${word}#${no}`;
    case 4:
      return `${word}_${no}`;
    case 5:
      let no_a = no % 1000;
      let no_b = random(1000);
      return `${no_a}${word}${no_b}`;
    case 6:
      return `@${word}@`;
    case 7:
      return `@${word}${no}`;
    default:
      return `USER-${word}`;
  }
}
