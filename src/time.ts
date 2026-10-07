import {Temporal} from '@js-temporal/polyfill';
export function localToUtc(value:string,zone:string):number {return Temporal.PlainDateTime.from(value).toZonedDateTime(zone,{disambiguation:'reject'}).epochMilliseconds;}
export function localDate(time:number,zone:string):string {return Temporal.Instant.fromEpochMilliseconds(time).toZonedDateTimeISO(zone).toPlainDate().toString();}
export function localInput(time:number,zone:string):string {return Temporal.Instant.fromEpochMilliseconds(time).toZonedDateTimeISO(zone).toPlainDateTime().toString({smallestUnit:'second'});}
export function dayRange(day:string,zone:string):[number,number] {const d=Temporal.PlainDate.from(day);return [d.toZonedDateTime(zone).epochMilliseconds,d.add({days:1}).toZonedDateTime(zone).epochMilliseconds-1];}
