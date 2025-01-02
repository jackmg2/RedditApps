import { randomId } from "../utils.js";
import { Link } from "./link.js";

export class Page {
    public id: string;
    public links: Link[];
    public title: string;

    constructor() {
        this.id = randomId();
        this.links = [
            new Link(), new Link(), new Link(), new Link(),
            new Link(), new Link(), new Link(), new Link(),
            new Link(), new Link(), new Link(), new Link(),
            new Link(), new Link(), new Link(), new Link()
        ];
        this.title = '';
    }

    public static fromData(data: {
        id: string,
        links: Link[],
        title: string
    }): Page {
        let page = new Page();
        page.id = data.id;
        page.links = data.links.map(l => Link.fromData(l));
        page.title = data.title;
        return page;
    }
}