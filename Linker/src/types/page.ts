import { randomId } from "../utils.js";
import { Link } from "./link.js";

export class Page {
    public id: string;
    public links: Link[];
    public title: string;
    public backgroundColor: string;
    public backgroundImage: string;
    public columns: number;

    constructor() {
        this.id = randomId();
        this.links = [
            new Link(), new Link(), new Link(), new Link(),
            new Link(), new Link(), new Link(), new Link(),
            new Link(), new Link(), new Link(), new Link(),
            new Link(), new Link(), new Link(), new Link()
        ];
        this.title = '';
        this.backgroundColor = '';
        this.backgroundImage = '';
        this.columns = 4; // Default number of columns
    }

    public static fromData(data: {
        id: string,
        links: Link[],
        title: string,
        backgroundColor?: string,
        backgroundImage?: string,
        columns?: number
    }): Page {
        let page = new Page();
        page.id = data.id;
        page.links = data.links.map(l => Link.fromData(l));
        page.title = data.title;
        page.backgroundColor = data.backgroundColor || '';
        page.backgroundImage = data.backgroundImage || '';
        page.columns = data.columns || 4;
        return page;
    }
}