
import "./polyfills";
import { environment } from "environments/environment";
import { AppModule } from "./app.module";
import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

if (environment.Production) {
    enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule);
