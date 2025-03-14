import { randomId, isNullOrEmpty } from "../utils.js";

export class Link {
  public id: string;
  public uri: string;
  public title: string;
  public image: string;
  public textColor: string;
  public description: string;

  constructor() {
    this.id = randomId();
    this.uri = '';
    this.title = '';
    this.image = '';
    this.textColor = '#FFFFFF';
    this.description = '';
  }

  public static isEmpty(link: Link) {
    const isNull = link == null || link == undefined || isNullOrEmpty(link.uri) && isNullOrEmpty(link.title) && isNullOrEmpty(link.image);
    return isNull;
  }

  public static fromData(data: {
    id: string,
    uri: string,
    title: string,
    image: string,
    textColor?: string,
    description?: string
  }): Link {
    let link = new Link();
    link.id = data.id;
    link.uri = data.uri;
    link.title = data.title;
    link.image = data.image;
    link.textColor = data.textColor || '#FFFFFF';
    link.description = data.description || '';

    return link;
  }
}