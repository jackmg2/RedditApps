import { randomId, isValidDate, isValidDateRange, isValidHexColor, isValidUrl } from '../utils/validators.js';

export class Event {
  public id: string;
  public title: string;
  public dateBegin: string;
  public dateEnd: string;
  public hourBegin: string;
  public hourEnd: string;
  public description: string;
  public link: string;
  public backgroundColor: string;
  public foregroundColor: string;

  constructor() {
    this.id = randomId();
    this.title = '';
    this.dateBegin = new Date().toISOString().split('T')[0];
    this.dateEnd = new Date().toISOString().split('T')[0];
    this.hourBegin = '';
    this.hourEnd = '';
    this.description = '';
    this.link = '';
    this.backgroundColor = '#101720';
    this.foregroundColor = '#F0FFF0';
  }

  public static fromData(data: {
    id: string,
    title: string,
    dateBegin: string,
    dateEnd: string,
    hourBegin?: string,
    hourEnd?: string,
    description: string,
    link: string,
    backgroundColor: string,
    foregroundColor: string
  }): Event {
    const event = new Event();
    event.id = data.id;
    event.title = data.title;
    event.dateBegin = data.dateBegin;
    event.dateEnd = data.dateEnd;
    event.hourBegin = data.hourBegin ?? '';
    event.hourEnd = data.hourEnd ?? '';
    event.description = data.description;
    event.link = data.link;
    event.backgroundColor = data.backgroundColor;
    event.foregroundColor = data.foregroundColor;
    return event;
  }

  public isValid(): string {
    if (!this.id?.trim()) {
      return 'Id can\'t be empty.';
    }

    if (!this.title?.trim()) {
      return 'Title can\'t be empty.';
    }

    if (!isValidDate(this.dateBegin) || !isValidDate(this.dateEnd)) {
      return 'Date begin and Date end must be in following format: YYYY-mm-dd.';
    }

    if (!isValidDateRange(this.dateBegin, this.dateEnd)) {
      return 'Date begin must be before Date end.';
    }

    if (!isValidUrl(this.link)) {
      return 'Url must start with https';
    }

    if (!isValidHexColor(this.backgroundColor) || !isValidHexColor(this.foregroundColor)) {
      return 'Color must be in hexadecimal. Ex: #FF00FF';
    }

    return '';
  }
}