import { randomId, isNullOrEmpty } from "../utils.js";

export class Link {
  public id: string;
  public uri: string;
  public title: string;
  public image: string;

  constructor() {
    this.id = randomId();
    this.uri = '';
    this.title = '';
    this.image = '';
  }

  public static isEmpty(link: Link) {
    const isNull = link == null || link == undefined || isNullOrEmpty(link.uri);
    return isNull;
  }

  public static fromData(data: {
    id: string,
    uri: string,
    title: string,
    image: string
  }): Link {
    let link = new Link();
    link.id = data.id;
    link.uri = data.uri;
    link.title = data.title;
    link.image = data.image;

    return link;
  }
}