import { randomId } from "../utils.js";
import { Page } from "./page.js";

export class Linker {
    public id: string;
    public pages: Page[];
  
    constructor() {
      this.id = randomId();
      this.pages = [new Page()];
    }

    public static fromData(data: {
        id: string,
        pages: Page[]
        
      }): Linker {
        let linker = new Linker();
        linker.id = data.id;      
        console.log('Data from Linker: '+JSON.stringify(data));
        linker.pages = data.pages.map(p=>Page.fromData(p));
    
        return linker;
      }
  
  }