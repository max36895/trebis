import {Request} from "./Request";
import {IRequestSend, IServerApiData, IServerApiRequest} from "../interfaces";

/**
 * Класс обращающийся к серверу с сохраненными дынными
 */
export class ServerApi {
    private _request: Request;

    public constructor() {
        this._request = new Request();
        this._request.header = Request.HEADER_AP_JSON;
    }

    protected _run(method: string, data: any): Promise<IRequestSend> {
        this._request.url = 'https://www.maxim-m.ru/rest/v1/trelo_statistic';
        this._request.post = {...data, ...{method}};
        return this._request.send();
    }

    public save(data: IServerApiData): Promise<IRequestSend> {
        return this._run('save', data);
    }

    public async get(year: string, orgId: string): Promise<IServerApiRequest> {
        const res = await this._run('get', {year, orgId});
        return res.data;
    }
}
