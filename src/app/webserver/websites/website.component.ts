import { Component, OnInit, Inject, ViewContainerRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { WebSite } from './site';
import { WebSitesService } from './websites.service';
import { ModuleUtil } from '../../utils/module';
import { DiffUtil } from '../../utils/diff';
import { OptionsService } from '../../main/options.service';
import { BreadcrumbService } from 'header/breadcrumbs.service';

@Component({
    template: `
        <not-found *ngIf="notFound"></not-found>
        <loading *ngIf="!(site || notFound)"></loading>
        <website-header *ngIf="site" [site]="site" class="crumb-content" [class.sidebar-nav-content]="_options.active"></website-header>
        <div *ngIf="site" class="sidebar crumb" [class.nav]="_options.active">
            <vtabs [contextName]="'WEBSITE '" [markLocation]="true" (activate)="_options.refresh()">
                <context-tab [reference]="webSiteRef"></context-tab>
                <context-tab [reference]="appPoolRef"></context-tab>
                <context-tab [reference]="filesRef"></context-tab>
                <vtabs-item [name]="'General'" [ico]="'fa fa-wrench'">
                    <website-general [site]="site" (modelChanged)="onModelChanged()"></website-general>
                </vtabs-item>
                <vtabs-item *ngFor="let module of modules" [name]="module.name" [ico]="module.ico">
                    <dynamic [name]="module.component_name" [module]="module" [data]="module.data"></dynamic>
                </vtabs-item>
            </vtabs>
        </div>
    `,
    styles: [`
        :host >>> .sidebar vtabs .vtabs > .items {
            top: 35px;
        }
        :host >>> .sidebar vtabs .vtabs > .content {
            top: 96px;
        }
    `]
})
export class WebSiteComponent implements OnInit {
    id: string;
    site: WebSite;
    notFound: boolean;
    modules: Array<any> = [];

    private _original: any;

    constructor(
        @Inject('Breadcrumb') public breadcrumb: BreadcrumbService,
        @Inject("WebSitesService") private _service: WebSitesService,
        private _route: ActivatedRoute,
        private _options: OptionsService) {
        this.id = this._route.snapshot.params['id'];
    }

    ngOnInit() {
        //
        // Async get website
        this._service.get(this.id)
            .then(s => {
                this.setSite(s);

                ModuleUtil.initModules(this.modules, this.site, "website");
            })
            .catch(s => {
                if (s && s.status == '404') {
                    this.notFound = true;
                }
            });
    }

    onModelChanged() {
        //
        // Track model changes
        if (this.site) {
            // Set up diff object
            var changes = DiffUtil.diff(this._original, this.site);
            
            if (Object.keys(changes).length > 0) {
                this._service.update(this.site, changes).then(s => this.setSite(s));
            }
        }
    }

    private setSite(s) {
        this.site = s;
        this._original = JSON.parse(JSON.stringify(s));
    }
}
