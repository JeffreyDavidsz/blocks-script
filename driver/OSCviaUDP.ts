/*
	Driver for sending OSC signals, based on http://opensoundcontrol.org/spec-1_0

 	Copyright (c) 2019 No Parking Production ApS, Denmark (https://noparking.dk). All Rights Reserved.
	Created by: Samuel Walz <mail@samwalz.com>
  Version: 0.2
  Features:
  - sending OSC messages
  - supported data types: int32, float32, string, boolean
 */

const MAX_SAFE_INTEGER = 9007199254740991; // Math.pow(2, 53) - 1;
const OSC_TYPE_TAG_INT32 = 'i';
const OSC_TYPE_TAG_FLOAT32 = 'f';
const OSC_TYPE_TAG_OSC_STRING = 's';
const OSC_TYPE_TAG_OSC_BLOB = 'b';

const OSC_TYPE_TAG_BOOLEAN_TRUE = 'T';
const OSC_TYPE_TAG_BOOLEAN_FALSE = 'F';
const split: any = require("lib/split-string");

import { NetworkUDP } from "system/Network";
import { Driver } from "system_lib/Driver";
import * as Meta from "system_lib/Metadata";



@Meta.driver('NetworkUDP', { port: 8000 })
export class OSCviaUDP extends Driver<NetworkUDP> {

    public constructor(private socket: NetworkUDP) {
        super(socket);
        // socket.subscribe('textReceived', (sender, message) => {
        // 	this.command = message.text
        // });
    }

    @Meta.callable('send OSC message')
    public sendMessage(
        @Meta.parameter('OSC address') address: string,
        @Meta.parameter('JSON array /wo brackets. fx to send the values 1 (int), 2.0 (float), and "hello" (string) \'1, 2.0, "hello"\' or "1, 2.0, \\"hello\\"".') values: string,
    ) {
        var messageStringParts = split(values, { separator: ',', quotes: true })
        if (values[0] != '[') {
            values = '[' + values + ']';
        }
        var message: [] = [];

        // read JSON in
        var data: [] = JSON.parse(values);
        for (var i = 0; i < data.length; i++) {
            const dataEntry = data[i];
            const dataString = messageStringParts[i];
            const typeName: string = typeof dataEntry;
            if (typeName === 'number') {
                this.addNumber(message, dataEntry, dataString);
            }
            if (typeName === 'string') {
                this.addString(message, dataEntry);
            }
            if (typeName === 'boolean') {
                this.addBoolean(message, dataEntry);
            }
            if (typeName == 'bigint') {

            }
        }

        var bytes: number[] = [];
        // first address
        this.addRange(bytes, this.toOSCStringBytes(address));
        // then data type tags
        this.addRange(bytes, this.toOSCStringBytes(this.renderDataTags(message)));
        // finally the data
        this.addRange(bytes, this.renderData(message));

        // send message
        this.socket.sendBytes(bytes);
    }

    public addBoolean(
        message: [],
        value: boolean
    ) {
        this.addValue(message, value ? OSC_TYPE_TAG_BOOLEAN_TRUE : OSC_TYPE_TAG_BOOLEAN_FALSE, []);
    }

    public addNumber(
        message: [],
        value: number,
        valueString: string
    ) {
        if (this.isInteger(value) &&
            valueString.indexOf('.') < 0) {
            this.addInteger(message, value);
        }
        else {
            this.addFloat(message, value);
        }
    }

    public addInteger(
        message: [],
        value: number
    ) {
        var bytes: number[] = this.getInt32Bytes(value);
        this.addValue(message, OSC_TYPE_TAG_INT32, bytes);
    }

    public addFloat(
        message: [],
        value: number
    ) {
        var bytes: number[] = this.getFloat32Bytes(value);
        this.addValue(message, OSC_TYPE_TAG_FLOAT32, bytes);
    }

    public addString(
        message: [],
        value: string
    ) {
        var bytes: number[] = this.toOSCStringBytes(value);
        this.addValue(message, OSC_TYPE_TAG_OSC_STRING, bytes);
    }

    private renderData(message: []): number[] {
        var bytes: number[] = [];
        var messageData: [] = message;
        for (var i = 0; i < messageData.length; i++) {
            this.addRange(bytes, messageData[i]['bytes']);
        }
        return bytes;
    }
    private renderDataTags(message: []): string {
        var dataTags: string = ',';
        var messageData: [] = message;
        for (var i = 0; i < messageData.length; i++) {
            dataTags += messageData[i]['type'];
        }
        return dataTags;
    }

    private addValue(message: {}[], valueType: string, bytes: number[]) {
        message.push({
            'type': valueType,
            'bytes': bytes
        });
    }

    private toOSCStringBytes(str: string): number[] {
        var bytes = this.toBytesString(str);
        // string has to end on zero char
        if (bytes.length > 0 &&
            bytes[bytes.length - 1] != 0) {
            bytes.push(0);
        }
        this.addZeroes(bytes);
        return bytes;
    }

    private addZeroes(bytes: number[]) {
        // how many zero chars are needed to make the length a multiple of 4?
        // (multiple 32bit chunks)
        var modFour = bytes.length % 4;
        if (modFour == 0) return;
        var missingZeroes: number = 4 - modFour;
        for (var i = 0; i < missingZeroes; i++) {
            bytes.push(0);
        }
    }

    private addRange(array: number[], values: number[]) {
        for (var i = 0; i < values.length; i++) {
            array.push(values[i]);
        }
    }

    private toBytesString(str: string): number[] {
        var bytes: number[] = [];
        for (var i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
        }
        return bytes;
    }

    private getInt32Bytes(x: number): number[] {
        var bytes = [];
        var i = 4;
        do {
            bytes[--i] = x & (255);
            x = x >> 8;
        } while (i)
        return bytes;
    }

    private getFloat32Bytes(float: number): number[] {
        var floatArray = new Float32Array(1);
        floatArray[0] = float;
        var byteArray = new Int8Array(floatArray.buffer);
        var bytes = [];
        for (var i = byteArray.length - 1; i >= 0; i--) {
            bytes.push(byteArray[i]);
        }
        return bytes;
    }

    isInteger(value: number): boolean {
        return typeof value === 'number' &&
            isFinite(value) &&
            Math.floor(value) === value;
    }
    isSafeInteger(value: number): boolean {
        return this.isInteger(value) &&
            Math.abs(value) <= MAX_SAFE_INTEGER;
    }
}