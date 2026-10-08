import type { DateValue } from "@internationalized/date";
import { getLocalTimeZone, parseAbsoluteToLocal, toZoned } from "@internationalized/date";

export const parseDateValue = (value: string | null): DateValue | null =>
  value ? parseAbsoluteToLocal(value) : null;

export const encodeDateValue = (value: DateValue | null) =>
  value ? toZoned(value, getLocalTimeZone()).toAbsoluteString() : null;
