import {IGetParams, IRequestSend} from "../interfaces";

/**
 * Класс отвечающий за отправку curl запросов на необходимый url.
 *
 * @class Request
 */
export class Request {
    public static readonly HEADER_AP_JSON: Record<string, string> = {'Content-Type': 'application/json'};
    public static readonly HEADER_FORM_DATA: Record<string, string> = {'Content-Type': 'multipart/form-data'};

    /**
     * Адрес, на который отправляется запрос.
     */
    public url: string;
    /**
     * Get параметры запроса.
     */
    public get: IGetParams;
    /**
     * Post параметры запроса.
     */
    public post: any;
    /**
     * Отправляемые заголовки.
     */
    public header: HeadersInit;
    /**
     * Кастомный (Пользовательский) заголовок (DELETE и тд.).
     */
    public customRequest: string;
    /**
     * Максимально время, за которое должен быть получен ответ. В мсек.
     */
    public maxTimeQuery: number;
    /**
     * Формат ответа.
     * True, если полученный ответ нужно преобразовать как json. По умолчанию true.
     */
    public isConvertJson: boolean;

    /**
     * Ошибки при выполнении запроса.
     */
    private _error: string;

    /**
     * TRequest constructor.
     */
    public constructor() {
        this.url = null;
        this.get = null;
        this.post = null;
        this.header = null;
        this.customRequest = null;
        this.maxTimeQuery = null;
        this.isConvertJson = true;
        this._error = '';
    }

    /**
     * Получение корректного  параметра для отправки запроса.
     * @return RequestInit
     * @private
     */
    protected _getOptions(): RequestInit {
        const options: RequestInit = {};

        if (this.maxTimeQuery) {
            const controller = new AbortController();
            const signal: AbortSignal = controller.signal;
            setTimeout(() => controller.abort(), this.maxTimeQuery);
            options.signal = signal;
        }

        if (this.post) {
            options.method = 'POST';
            options.body = JSON.stringify(this.post);
        }

        if (this.header) {
            options.headers = this.header;
        }

        if (this.customRequest) {
            options.method = this.customRequest;
        }
        return options;
    }

    public static getQueryString(params): string {
        return Object.keys(params)
            .map(key => `${key}=${params[key]}`)
            .join('&');
    }

    /**
     * Получение url адреса с get запросом.
     *
     * @return string
     * @private
     */
    protected _getUrl(): string {
        let url: string = this.url;
        if (this.get) {
            url += '?' + Request.getQueryString(this.get);
        }
        return url;
    }

    /**
     * Начинаем отправку fetch запроса.
     * В случае успеха возвращаем содержимое запроса, в противном случае null.
     *
     * @return Promise<any>
     */
    private async _run(): Promise<any> {
        if (this.url) {
            const response = await fetch(this._getUrl(), this._getOptions());
            if (response.ok) {
                if (this.isConvertJson) {
                    return await response.json();
                }
                return await response.text();
            }
            this._error = 'Не удалось получить данные с ' + this.url;
        } else {
            this._error = 'Не указан url!';
        }
        return null;
    }

    /**
     * Отправка запроса.
     * Возвращаем массив. В случае успеха свойство 'status' = true.
     *
     * @param {string} url Адрес, на который отправляется запрос.
     * @return Promise<IRequestSend>
     * @api
     */
    public async send(url: string = null): Promise<IRequestSend> {
        if (url) {
            this.url = url;
        }

        this._error = null;
        const data: any = await this._run();
        if (this._error) {
            return {status: false, err: this._error};
        }
        return {status: true, data};
    }
}
