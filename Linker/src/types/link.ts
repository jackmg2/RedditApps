import { randomId, isNullOrEmpty } from "../utils.js";

export class Link {
  public id: string;
  public uri: string;
  public title: string;
  public image: string;
  public textColor: string;
  public description: string;
  public backgroundColor: string; // Added for title background
  public backgroundOpacity: number; // Added for title background opacity

  constructor() {
    this.id = randomId();
    this.uri = '';
    this.title = '';
    this.image = '';
    this.textColor = '#FFFFFF';
    this.description = '';
    this.backgroundColor = '#000000'; // Default black
    this.backgroundOpacity = 0.5; // Default 50% opacity
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
    description?: string,
    backgroundColor?: string,
    backgroundOpacity?: number
  }): Link {
    let link = new Link();
    link.id = data.id;
    link.uri = data.uri;
    link.title = data.title;
    link.image = data.image;
    link.textColor = data.textColor || '#FFFFFF';
    link.description = data.description || '';
    link.backgroundColor = data.backgroundColor || '#000000';
    link.backgroundOpacity = data.backgroundOpacity !== undefined ? data.backgroundOpacity : 0.5;

    return link;
  }
}