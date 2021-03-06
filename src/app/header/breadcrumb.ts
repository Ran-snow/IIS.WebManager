import { IsWAC } from "environments/environment";
import { WebSitesModuleName, AppPoolsModuleName } from "main/settings";
import { SectionHelper } from "common/section.helper";

export const HomeModuleName = "Home";
export const BreadcrumbsRoot = IsWAC ? [<Breadcrumb>{ label: "IIS" }] : [<Breadcrumb>{ label: HomeModuleName, routerLink: ["/"] }];
export const WebSitesCrumb = <Breadcrumb>{ label: WebSitesModuleName, routerLink: [`/webserver/${SectionHelper.normalize(WebSitesModuleName)}`]};
export const AppPoolsCrumb = <Breadcrumb>{ label: AppPoolsModuleName, routerLink: [`/webserver/${SectionHelper.normalize(AppPoolsModuleName)}`]};

export class Breadcrumb {
    public label: string;
    public routerLink: string[];
}
