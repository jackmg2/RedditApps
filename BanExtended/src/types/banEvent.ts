import { JSONObject } from '@devvit/public-api';
export class BanEvent {
    public banDuration: number | undefined;
    public ruleViolated: string;
    public banMessage: string;
    public removeContent: string;
    public markAsSpam: boolean;
    public username: string;
    public subRedditName: string;

    constructor() {
        this.banDuration = undefined;
        this.ruleViolated = '';
        this.banMessage = '';
        this.removeContent = '';
        this.markAsSpam = false;
        this.username = '';
        this.subRedditName = '';
    }

    public static fromJson(json: JSONObject): BanEvent {
        let banEvent = new BanEvent();

        banEvent.banDuration = json.banDuration == 'permanent' ? undefined : parseInt(json.banDuration as string);
        banEvent.ruleViolated = json.ruleViolated as string;
        banEvent.banMessage = json.banMessage as string;
        banEvent.removeContent = json.removeContent as string;
        banEvent.markAsSpam = json.markAsSpam as boolean;
        banEvent.username = json.username as string;
        banEvent.subRedditName = json.subRedditName as string;

        return banEvent;
    }
}