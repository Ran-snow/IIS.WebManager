import { DateTime } from '../common/primitives';
import { Injectable, Inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import {
    AppContextService,
    NavigationService
} from '@microsoft/windows-admin-center-sdk/angular';
import { Runtime } from './runtime';
import { ApiErrorType, UnexpectedServerStatusError } from 'error/api-error';
import { PowershellService } from './wac/services/powershell-service';
import { ConnectService } from '../connect/connect.service';
import { ApiConnection } from '../connect/api-connection';
import { PowerShellScripts } from 'generated/powershell-scripts'
import { RpcOutboundCommands, rpcVersion, RpcInitDataInternal } from '@microsoft/windows-admin-center-sdk/core/rpc/rpc-base';
import { CoreEnvironment, RpcSeekMode } from '@microsoft/windows-admin-center-sdk/core';
import { map, shareReplay, mergeMap, catchError } from 'rxjs/operators';
import { LoggerFactory, Logger, LogLevel } from 'diagnostics/logger';
import { SETTINGS } from 'main/settings';
import { throwError, Observable } from 'rxjs';

class ApiKey {
    public id: string
    public access_token: string
    public expires_on: DateTime
    public value: string
}

class HostStatus {
    public adminAPIInstalled: boolean
    public groupModified: boolean
    public apiHost: string
}

@Injectable()
export class WACInfo {
    constructor(private appContext: AppContextService){}
    public get NodeName(): Observable<string> {
        return this.appContext.servicesReady.pipe(
            map(_ => this.appContext.activeConnection.nodeName),
            shareReplay(),
        );
    }
}

@Injectable()
export class WACRuntime implements Runtime {
    private _tokenId: string;
    private _apiHost: string;
    private _connecting: Observable<ApiConnection>;
    private _logger: Logger;

    constructor(
        private injector: Injector,
        private router: Router,
        private appContext: AppContextService,
        private connectService: ConnectService,
        private loggerFactory: LoggerFactory,
        private navigationService: NavigationService,
        @Inject("Powershell") private powershellService: PowershellService,
        @Inject("WACInfo") private wac: WACInfo,
    ){
        this._logger = loggerFactory.Create(this);
    }

    public OnModuleCreate(): void {
        this.appContext.initializeModule({});
    }

    public OnAppInit(): void {
        this.appContext.ngInit({ navigationService: this.navigationService });
    }

    public OnAppDestroy(): void {
        if (this._tokenId) {
            this.powershellService.run(PowerShellScripts.token_utils.script, {
                command: 'delete',
                tokenId: this._tokenId,
                apiHost: this._apiHost,
            }).subscribe(null, null, () => this.appContext.ngDestroy());
        } else {
            this.appContext.ngDestroy();
        }
    }

    public ConnectToIISHost(): Observable<ApiConnection> {
        if (!this._connecting) {
            this._connecting = this.wac.NodeName.pipe(
                mergeMap(nodeName =>
                this.GetApiKey().pipe(map((apiKey, _) => {
                    var connection = new ApiConnection(nodeName)
                    if (apiKey.access_token) {
                        connection.accessToken = apiKey.access_token
                    } else {
                        connection.accessToken = apiKey.value
                    }
                    this._tokenId = apiKey.id
                    this.connectService.setActive(connection)
                    this._connecting = null
                    return connection
                }))),
                shareReplay()
            )
        }
        return this._connecting
    }

    public PrepareIISHost(p: any): Observable<any> {
        p.appMinVersion = SETTINGS.api_setup_version;
        return this.powershellService.run(PowerShellScripts.admin_api_util.script, p).pipe(
            map((status: HostStatus) => {
                this._apiHost = status.apiHost;
                if (status.groupModified) {
                    this.powershellService.Reset();
                }
                return status;
            }),
        );
    }

    public StartIISAdministration(): Observable<any> {
        return this.powershellService.run(PowerShellScripts.start_admin_api.script, {})
    }

    private GetApiKey(): Observable<ApiKey> {
        return this.PrepareIISHost({ command: 'ensure' }).pipe(
            catchError((e, _) => {
                if (e.status === 400 && e.response && e.response.exception) {
                    let errContent: any;
                    try {
                        errContent = JSON.parse(e.response.exception);
                    } catch (e) {
                        this._logger.log(LogLevel.INFO,
                            `Unable to parse error message ${e.response.exception}, the error must be unexpected`);
                    }
                    if (errContent) {
                        if (errContent.Type === 'PREREQ_BELOW_MIN_VERSION') {
                            return throwError({
                                type: ApiErrorType.Unreachable,
                                details: `To manage IIS Server, you need to install ${errContent.App} version ${errContent.Required} or higher. Current version detected: ${errContent.Actual}`,
                            });
                        }
                        if (errContent.Type === 'ADMIN_API_SERVICE_NOT_FOUND') {
                            return throwError({
                                type: ApiErrorType.Unreachable,
                                details: `To manage an IIS Server, you need to install ${errContent.App} on IIS host`,
                            });
                        }
                        if (errContent.Type === 'ADMIN_API_SERVICE_NOT_RUNNING') {
                            return throwError(new UnexpectedServerStatusError(errContent.Status));
                        }
                    }
                }
                return throwError(e);
            }),
            mergeMap(_ => {
                var tokenUtilParams: any = {
                    command: 'ensure',
                    apiHost: this._apiHost,
                };
                if (this._tokenId) {
                    tokenUtilParams.tokenId = this._tokenId;
                }
                return this.powershellService.run<ApiKey>(PowerShellScripts.token_utils.script, tokenUtilParams);
            })
        );
    }

    public HandleConnectError(err: any): any {
        if (err.type && err.type === ApiErrorType.Unreachable) {
            this._logger.log(LogLevel.INFO, "Navigating to install page...");
            this.router.navigate(['install'], { queryParams: {
                details: err.details,
            }});
            return null;
        }
        return err;
    }
}
