import {Component, OnInit, Inject} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {DiffUtil} from '../../utils/diff';
import {OptionsService} from '../../main/options.service';
import {ApplicationPool} from './app-pool';
import {AppPoolsService} from './app-pools.service';
import { BreadcrumbsService } from 'header/breadcrumbs.service';
import { BreadcrumbsRoot, AppPoolsCrumb, Breadcrumb } from 'header/breadcrumb';
import { AppPoolsModuleName } from 'main/settings';

@Component({
    template: `
        <not-found *ngIf="notFound"></not-found>
        <loading *ngIf="!(pool || notFound)"></loading>
        <app-pool-header *ngIf="pool" [pool]="pool" class="crumb-content" [class.sidebar-nav-content]="_options.active"></app-pool-header>
        <feature-vtabs *ngIf="pool" [model]="pool" [resource]="'appPool'" [subcategory]="'${AppPoolsModuleName}'">
            <app-pool-general class="general-tab" [pool]="pool" (modelChanged)="onModelChanged()"></app-pool-general>
        </feature-vtabs>
`,
})
export class AppPoolComponent implements OnInit {
    pool: ApplicationPool;
    notFound: boolean;
    private id: string;
    private _original: ApplicationPool;

    constructor(
        private _route: ActivatedRoute,
        private _options: OptionsService,
        private _router: Router,
        private crumbs: BreadcrumbsService,
        @Inject("AppPoolsService") private _service: AppPoolsService,
    ){
        this.id = this._route.snapshot.params['id'];
    }

    ngOnInit() {
        this._service.get(this.id)
            .then(p => {
                this.setAppPool(p);
                this.crumbs.load(
                    BreadcrumbsRoot.concat(
                        AppPoolsCrumb,
                        <Breadcrumb>{ label: p.name },
                    ));
            })
            .catch(s => {
                if (s && s.status == '404') {
                    this.notFound = true;
                }
            });
    }

    onModelChanged() {
        if (!this.pool) {
            return;
        }

        // Set up diff object
        var changes = DiffUtil.diff(this._original, this.pool);

        if (Object.keys(changes).length > 0) {
            var id = this.pool.id;
            this._service.update(this.pool, changes).then(p => {
                if (p.id != id) {
                    //
                    // Refresh if the Id has changed
                    this._router.navigate(['webserver', 'app-pools', p.id]);
                }
                else {
                    this.setAppPool(p);
                }
            });
        }
    }

    private setAppPool(p: ApplicationPool) {
        this.pool = p;
        this._original = JSON.parse(JSON.stringify(p));
    }
}
