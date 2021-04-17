interface IRequestSend {
    /**
     * Статус ответа. True, если запрос успешно выполнился, иначе false.
     */
    status: boolean;
    /**
     * Полученные данные.
     */
    data?: any;
    /**
     * Ошибка при отправке запроса.
     */
    err?: string
}

interface IGetParams {
    [key: string]: string;
}

interface ITrelloOrg {
    boards: ITrelloListData[];
}

interface ITrelloData {
    key?: string;
    token?: string;

    [key: string]: any;
}

interface ITrelloListData {
    id?: string;
    name?: string;

    [key: string]: any;
}

interface ITrelloLabel {
    color: string;
    id: string;
}

interface ITrelloCardData {
    id?: string;
    name?: string;
    desc?: string;
    labels?: ITrelloLabel[];

    [key: string]: any;
}

interface ITrebisLabel {
    [color: string]: string;
}

interface ILocalStorage {
    key: string;
    token: string;
}

interface ITrebisStatistic {
    red: number;
    yellow: number;
    blue: number;
    green: number;
}


interface IServerApiData {
    name?: string;
    data?: {
        [year: string]: {
            [month: string]: {
                [day: string]: ITrebisStatistic
            }
        }
    }
}


interface IServerApiRequestData {
    [boardName: string]: {
        [month: string]: ITrebisStatistic
    }
}

interface IServerApiRequest {
    data: IServerApiRequest;
    total: IServerApiRequestData;
}

/**
 * Закидываем в namespace, чтобы наверняка не нарваться на одинаковые название классов.
 * Сейчас расширение взаимодействует с интерфейсом trello и может использовать его методы и классы.
 */
namespace TREBIS {
    /**
     * Класс отвечающий за отправку curl запросов на необходимый url.
     *
     * @class TRequest
     */
    class TRequest {
        public static readonly HEADER_RSS_XML: Record<string, string> = {'Content-Type': 'application/rss+xml'};
        public static readonly HEADER_GZIP: Record<string, string> = {'Content-Encoding': 'gzip'};
        public static readonly HEADER_AP_JSON: Record<string, string> = {'Content-Type': 'application/json'};
        public static readonly HEADER_AP_XML: Record<string, string> = {'Content-Type': 'application/xml'};
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
                const timeoutId = setTimeout(() => controller.abort(), this.maxTimeQuery);
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

        protected _getQueryString(params): string {
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
                url += '?' + this._getQueryString(this.get);
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

    /**
     * Класс обращающийся к серверу
     */
    class ServerApi {
        private _request: TRequest;

        public constructor() {
            this._request = new TRequest();
            this._request.header = TRequest.HEADER_AP_JSON;
        }

        protected _run(method: string, data: any) {
            this._request.url = 'https://www.maxim-m.ru/rest/v1/trelo_statistic';
            this._request.post = {...data, ...{method}};
            return this._request.send();
        }

        public save(data: IServerApiData) {
            return this._run('save', data);
        }

        public async get(year: string) {
            const res = await this._run('get', {year});
            return res.data;
        }
    }

    /**
     * Класс отвечающий за работу с trello api
     */
    class TrelloApi {
        private _request: TRequest;
        public key: string;
        public token: string;
        public isSendForApi: boolean = false;
        public trelloToken: string;
        /**
         * Можно отправлять запросы на trello.com не используя api.
         * По сути разницы нет, только в 1 случае нам не нужно беспокоиться о том, что нужно вводить ключ и токен
         */
        public readonly DEFAULT_URL = 'https://trello.com';
        public readonly API_URL = 'https://api.trello.com';

        public constructor() {
            this._request = new TRequest();
            this._request.header = TRequest.HEADER_AP_JSON;
        }

        protected _getUrl(): string {
            if (this.isSendForApi) {
                return this.API_URL;
            }
            return this.DEFAULT_URL;
        }

        protected _getPost(data: ITrelloData): ITrelloData {
            if (this.isSendForApi) {
                return {...{key: this.key, token: this.token}, ...data};
            } else {
                return {...{token: this.trelloToken}, ...data};
            }
        }

        protected _getQueryString(params): string {
            return Object.keys(params)
                .map(key => `${key}=${params[key]}`)
                .join('&');
        }

        /**
         * Получаем информацию об организации включая доступные доски
         * @param orgName
         */
        public async getOrganizations(orgName: string): Promise<ITrelloOrg> {
            let query: string = '';
            if (this.isSendForApi) {
                query = '&' + this._getQueryString(this._getPost({}));
            }
            this._request.post = null;
            this._request.url = this._getUrl() + `/1/Organizations/${orgName}?boards=open&board_fields=name%2Cclosed%2CdateLastActivity%2CdateLastView%2CdatePluginDisable%2CenterpriseOwned%2CidOrganization%2Cprefs%2CpremiumFeatures%2CshortLink%2CshortUrl%2Curl%2CcreationMethod%2CidEnterprise%2CidTags&board_starCounts=organization&board_membershipCounts=active&fields=name%2CdisplayName%2Cproducts%2Cprefs%2CpremiumFeatures%2ClogoHash%2CidEnterprise%2Ctags%2Climits%2Ccredits%2Cdesc%2CdescData%2Cwebsite%2Climits%2CbillableCollaboratorCount&paidAccount=true&paidAccount_fields=products%2Cstanding%2CbillingDates%2CexpirationDates%2CneedsCreditCardUpdate%2CdateFirstSubscription&enterprise=true&memberships=active&members=all&tags=true&billableCollaboratorCount=true` + query;
            const send = await this._request.send();
            return send.data;
        }

        /**
         * Получение всех досок пользователя
         */
        public async getBoards() {
            let query: string = '';
            if (this.isSendForApi) {
                query = '&' + this._getQueryString(this._getPost({}));
            }
            this._request.post = null;
            this._request.url = this._getUrl() + '/1/members/me/boards?fields=name%2CshortLink' + query;
            const send = await this._request.send();
            return send.data;
        }

        /**
         * Получение всех списков пользователя на определенно доске
         * @param boardId
         */
        public async getLists(boardId: string): Promise<ITrelloListData[]> {
            let query: string = '';
            if (this.isSendForApi) {
                query = '?' + this._getQueryString(this._getPost({}));
            }
            this._request.post = null;
            this._request.url = `${this._getUrl()}/1/boards/${boardId}/lists` + query;
            const send = await this._request.send();
            return send.data;
        }

        /**
         * Удаление определенного списка
         * @param listId
         */
        public async deleteList(listId: string) {
            this._request.header['Accept'] = 'application/json';
            this._request.customRequest = 'PUT';
            this._request.url = `${this._getUrl()}/1/lists/${listId}/`;
            this._request.post = this._getPost({closed: true});
            const res = await this._request.send();
            this._request.customRequest = null;
            this._request.header = TRequest.HEADER_AP_JSON;
            return res;
        }

        public isLink(text: string): boolean {
            if (text) {
                return !!text.match(/((http|s:\/\/)[^( |\n)]+)/umig);
            }
            return false;
        }

        /**
         * Добавление списка
         * @param data
         */
        public async addList(data: ITrelloData): Promise<IRequestSend> {
            this._request.post = this._getPost({
                pos: "top",
                name: data.name || Trebis.date(),
                idBoard: data.idBoard
            });
            this._request.url = this._getUrl() + "/1/lists";
            return await this._request.send();
        }

        /**
         * Получение всех карточек из списка
         * @param listId
         */
        public async getCards(listId: string): Promise<ITrelloCardData[]> {
            let query: string = '';
            if (this.isSendForApi) {
                query = '&' + this._getQueryString(this._getPost({}));
            }
            this._request.post = null;
            this._request.url = `${this._getUrl()}/1/lists/${listId}/cards?fields=all` + query;
            const send = await this._request.send();
            return send.data;
        }

        /**
         * Получение всех меток доски
         * @param boardId
         */
        public async getLabels(boardId: string): Promise<ITrebisLabel[]> {
            let query: string = '';
            if (this.isSendForApi) {
                query = '?' + this._getQueryString(this._getPost({}));
            }
            this._request.post = null;
            this._request.url = `${this._getUrl()}/1/boards/${boardId}/labels` + query;
            const send = await this._request.send();
            return send.data;
        }

        /**
         * Добавление метки для карточки
         * @param cardId
         * @param labelId
         */
        public async addLabels(cardId: string, labelId: string): Promise<IRequestSend> {
            this._request.url = `${this._getUrl()}/1/cards/${cardId}/idLabels`;
            this._request.post = this._getPost({value: labelId});
            return await this._request.send();
        }

        public async deleteLabels(cardId: string, labelId: string): Promise<IRequestSend> {
            this._request.customRequest = "DELETE";
            let query: string = '';
            if (this.isSendForApi) {
                query = '?' + this._getQueryString(this._getPost({}));
            }
            this._request.url = `${this._getUrl()}/1/cards/${cardId}/idLabels/${labelId}` + query;
            this._request.post = null;
            const res = await this._request.send();
            this._request.customRequest = null;
            return res;
        }

        /**
         * Обновление карточки
         * @param cardId
         * @param data
         */
        public async updateCard(cardId: string, data: ITrelloData = {}): Promise<ITrelloCardData> {
            this._request.header['Accept'] = 'application/json';
            this._request.customRequest = 'PUT';
            this._request.url = `${this._getUrl()}/1/cards/${cardId}`;
            if (data.name) {
                const names = data.name.split(' ');
                names.forEach((name) => {
                    if (this.isLink(name)) {
                        if (!data.desc.includes(name)) {
                            data.desc = `[Ссылка на задачу](${name})\n${data.desc}`;
                        }
                    }
                })
            }
            this._request.post = this._getPost(data);
            const res = await this._request.send();
            this._request.customRequest = null;
            this._request.header = TRequest.HEADER_AP_JSON;
            return res;
        }

        /**
         * Добавление карточки
         * @param data
         */
        public async addCard(data: ITrelloData): Promise<ITrelloCardData> {
            this._request.url = this._getUrl() + "/1/cards";
            this._request.post = this._getPost(data);
            return await this._request.send();
        }
    }

    /**
     * Класс выполняющий необходимые действия с trello
     */
    class Trebis {
        private DAY = 3600 * 24 * 1000;

        public trello: TrelloApi;

        protected labels: ITrebisLabel = null;

        public boardId: string = null;
        public thisListId: string = null;
        protected lastListId: string = null;

        public constructor(key: string = null, token: string = null) {
            this.trello = new TrelloApi();
            this.initKeyToken(key, token);
        }

        /**
         * Получение корректной даты в формате d.m.Y
         * @param time
         * @param isFullYear
         */
        public static date(time: number = null, isFullYear: boolean = false): string {
            if (time === null) {
                time = Date.now();
            }
            const date = new Date(time);
            let day = date.getDate();
            let month = date.getMonth() + 1;

            let result;
            if (day < 10) {
                result = `0${day}`;
            } else {
                result = day + ``;
            }
            result += '.';
            if (month < 10) {
                result += `0${month}`;
            } else {
                result += month;
            }
            result += '.' + (date.getFullYear() - (isFullYear ? 0 : 2000));
            return result;
        }

        public initKeyToken(key: string = null, token: string = null): void {
            if (key) {
                this.trello.key = key;
            }
            if (token) {
                this.trello.token = token;
                this.trello.isSendForApi = true;
            }
        }

        /**
         * Получение идентификатора доски.
         * Он нужен для добавления, обновления и удаления карточек и списков
         * @param shortLink
         */
        public async getBoardId(shortLink: string): Promise<string> {
            /**
             * Получаем все доски пользователя
             */
            let boards = await this.trello.getBoards();
            this.boardId = null;
            boards.forEach((board) => {
                if (shortLink.includes(board.shortLink)) {
                    this.boardId = board.id;
                }
            });
            if (!this.boardId) {
                /**
                 * Может быть так, что у пользователя нет доски, но при этом он привязан к доске организации
                 * У Вани например так. Поэтому получаем все доски организации и ищем нужную доску.
                 * + в том, что можно залезть в чужую доску и работать с ней
                 */
                boards = await this.trello.getOrganizations('basecontrol');
                if (boards) {
                    boards.boards.forEach((board) => {
                        if (shortLink.includes(board.shortLink)) {
                            this.boardId = board.id;
                        }
                    });
                }
                /**
                 * Пусть пока будет тут. Тут осуществляется поиск по имени доски,
                 * но если есть 2 одинаковые доски, то будет боль...
                 */
                /*const boardNameEl: HTMLInputElement = document.querySelector('.board-name-input');
                if (boardNameEl) {
                    const boardName: string = boardNameEl.value.toLowerCase().trim();
                    boards.forEach((board) => {
                        if (board.name.toLowerCase().trim().includes(boardName)) {
                            this.boardId = board.id;
                        }
                    });
                }*/
            }

            return this.boardId;
        }

        /**
         * Получаем все метки
         */
        public async initLabels(): Promise<void> {
            if (this.boardId) {
                const labels = await this.trello.getLabels(this.boardId);
                this.labels = {};
                labels.forEach((label) => {
                    this.labels[label.color] = label.id;
                })
            } else {
                this._logs('initLabels(): Не указан идентификатор доски!');
            }
        }

        public async createList(name?: string): Promise<void> {
            this.thisListId = null;
            if (this.boardId) {
                const result = await this.trello.addList({idBoard: this.boardId, name});
                if (result.status && result.data) {
                    this.thisListId = result.data.id || null;
                }
            } else {
                this._logs('createList(): Не указан идентификатор доски!');
            }
        }

        /**
         * Получаем ид списка
         * @param lists
         * @param name
         */
        public getListId(lists: ITrelloListData[], name: string): string {
            const parseName: Date = getDate(name);
            for (const list of lists) {
                const parseListName = getDate(list.name);
                if ((parseListName && parseName) && isEqualDate(parseListName, parseName)) {
                    return list.id
                } else if (name === list.name) {
                    return list.id
                }
            }
            return null;
        }

        /**
         * Получаем ид списка для текущей даты. Если списка нет, то создаем его.
         * Также получаем ид списка с предыдущей даты
         *
         * При этом для оптимизации, ищем список за последние 15 дней.
         *
         * @param lists
         * @protected
         */
        protected async initListId(lists: ITrelloListData[]): Promise<void> {
            if (!this.thisListId) {
                this.thisListId = await this.getListId(lists, Trebis.date());
                if (this.thisListId) {
                    await this.createList();
                }
            }

            let day = 1;
            do {
                const name: string = Trebis.date(Date.now() - (this.DAY * day));
                this.lastListId = await this.getListId(lists, name);
                day++;
                if (day > 15) {
                    break;
                }
            } while (!this.lastListId);
        }

        public async createCard(data, labels): Promise<void> {
            const req = await this.trello.addCard(data);
            const cardId = req.data.id || null
            if (cardId) {
                for (const label of labels) {
                    await this.trello.addLabels(cardId, label);
                }
            } else {
                this._logs('CreateCard(): Не удалось создать карточку!');
            }
        }

        public async updateCard(): Promise<void> {
            if (this.boardId) {
                const lists: ITrelloListData[] = await this.trello.getLists(this.boardId);
                await this.initListId(lists);

                if (this.lastListId) {
                    const thisCards: ITrelloCardData[] = await this.trello.getCards(this.thisListId);
                    const lastCards: ITrelloCardData[] = await this.trello.getCards(this.lastListId);

                    for (let lastCard of lastCards) {
                        const data = {
                            name: lastCard.name,
                            desc: lastCard.desc
                        };
                        const updateCard = await this.trello.updateCard(lastCard.id, data);
                        if (updateCard.status && updateCard.data) {
                            lastCard = updateCard.data;
                        }
                        let addedCard = true;
                        let addedLabels: string[] = [];
                        for (const label of lastCard.labels) {
                            if (['green', 'blue'].includes(label.color)) {
                                addedCard = false;
                                addedLabels = [];
                                break;
                            }
                            if (label.color !== 'red') {
                                addedLabels.push(label.id);
                            }
                        }
                        if (addedCard) {
                            let isAdded = true;
                            for (const thisCard of thisCards) {
                                if (thisCard.name === lastCard.name) {
                                    isAdded = false;
                                    break;
                                }
                            }
                            if (isAdded) {
                                const data = {
                                    idList: this.thisListId,
                                    name: lastCard.name,
                                    desc: lastCard.desc
                                };
                                addedLabels.push(this.labels.yellow);
                                await this.createCard(data, addedLabels);
                                await this.trello.addLabels(lastCard.id, this.labels.red);
                            }
                        }
                    }
                } else {
                    this._logs('updateCard(): Не удалось найти карточку за предыдущий рабочий день!');
                }
            } else {
                this._logs('updateCard(): Не указан идентификатор доски!');
            }
        }

        /**
         * Удаление старых списков. Как правильнее сделать не понятно. Поэтому временно оставлю как есть
         * @param lists
         */
        public async removeOldLists(lists: ITrelloListData[]) {
            let day = 30;
            // todo придумать как сделать сейчас не понятно как корректно отфильтровать и удалять карточки
            // Сейчас оставляю первые 30 карточек + может быть бага с годами...
            lists.forEach((list) => {
                if (day === 0) {
                    this.trello.deleteList(list.id);
                } else {
                    day--;
                }
            })
        }

        protected getCorrectDate(oldDate: Date, thisDate: Date): Date {
            const date: Date = thisDate;

            // @ts-ignore
            let difference: number = (oldDate - thisDate);
            difference = difference * (difference < 0 ? (-1) : 1);
            // Если разница больше чем полгода, то скорей всего пользователь опечатался
            if (difference >= 15767993085) {
                date.setFullYear(oldDate.getFullYear());
            }
            return date;
        }

        /**
         * Получение статистики по доске.
         * Важно чтобы boardId был проинициализирован, иначе будет ошибка
         */
        public async getStatistic(startValue: string, endValue: string,
                                  options: { isSaveOnServer: boolean, boardName: string } = null): Promise<ITrebisStatistic> {
            if (!this.boardId) {
                return null;
            }
            const lists: ITrelloListData[] = await this.trello.getLists(this.boardId);
            await this.initLabels();
            const res = {
                red: 0,
                yellow: 0,
                blue: 0,
                green: 0
            }
            let isStart = false;

            const startDate: Date = getDate(startValue);
            const endDate: Date = getDate(endValue);
            let oldListDate: Date = null;
            let serverApiData: IServerApiData = {
                name: null,
                data: {}
            };

            for (const list of lists) {
                let listDate: Date = getDate(list.name)
                if (oldListDate) {
                    listDate = this.getCorrectDate(oldListDate, listDate);
                }
                if (oldListDate && oldListDate < listDate) {
                    // Если в дате есть год, то все оставляем как есть.
                    // Если год не указан, то по умолчанию ставится текущий год, поэтому вычитаем 1 год
                    if (list.name.split(list.name.includes('.') ? '.' : '-').length < 3) {
                        listDate.setFullYear(oldListDate.getFullYear() - 1);
                    }
                }
                if (list.name === endValue || (
                    (endDate && listDate) && (listDate <= endDate)
                )) {
                    isStart = true;
                }

                if ((startDate && listDate) && (startDate > listDate)) {
                    break;
                }
                if (isStart) {
                    const cards: ITrelloCardData[] = await this.trello.getCards(list.id);
                    for (const card of cards) {
                        for (const label of card.labels) {
                            if (['green', 'blue', 'red', 'yellow'].includes(label.color)) {
                                res[label.color] += 1;
                                if (options && options.isSaveOnServer) {
                                    // todo Продумать корректное поведение. Если не удалось получить дату, а метки есть, они уходят в никуда...
                                    // Временное решение - смотреть на предыдущую дату если текущую определить не удалось.
                                    let tmpListDate = listDate;
                                    if (!tmpListDate) {
                                        tmpListDate = oldListDate;
                                    }

                                    if (tmpListDate) {
                                        let listDateYear = serverApiData.data[tmpListDate.getFullYear()];
                                        if (!listDateYear) {
                                            listDateYear = {};
                                        }

                                        let listDateMonth = listDateYear[tmpListDate.getMonth()];
                                        if (!listDateMonth) {
                                            listDateMonth = {};
                                        }

                                        if (!listDateMonth[tmpListDate.getDate()]) {
                                            listDateMonth[tmpListDate.getDate()] = {
                                                red: 0,
                                                blue: 0,
                                                yellow: 0,
                                                green: 0
                                            };
                                        }
                                        listDateMonth[tmpListDate.getDate()][label.color] += 1;

                                        listDateYear[tmpListDate.getMonth()] = listDateMonth;
                                        serverApiData.data[tmpListDate.getFullYear()] = listDateYear;
                                    }
                                    tmpListDate = null;
                                }
                            }
                        }
                    }
                }

                if (list.name === startValue || (
                    (startDate && listDate) && isEqualDate(startDate, listDate)
                )) {
                    break;
                }
                oldListDate = listDate;
            }

            if (options && options.isSaveOnServer && res) {
                const serverApi = new ServerApi();
                serverApiData.name = options.boardName;
                await serverApi.save(serverApiData);
                serverApiData = null;
            }

            return res;
        }

        protected _logs(error: string): void {
            console.error(error);
        }
    }


    /**
     * Само приложение, работающее с интерфейсом trello
     */
    class Application {
        private readonly ADMIN_USERS = ['maxim45387091', 'krasilnikow'];
        protected _trebis: Trebis;

        protected trebisInit() {
            const trelloToken = this.getCookie('token');
            let localStorage: ILocalStorage = null;
            if (!trelloToken) {
                localStorage = this.getLocalStorage();
            }
            if (trelloToken || localStorage) {
                this._trebis = new Trebis();
                if (!trelloToken && localStorage) {
                    const key = localStorage.key;
                    const token = localStorage.token;
                    this._trebis.initKeyToken(key, token);
                } else {
                    this._trebis.trello.isSendForApi = false;
                    this._trebis.trello.trelloToken = trelloToken;
                }
                return true
            } else {
                this._trebis = null;
            }
            return false;
        }

        public getLocalStorage(): ILocalStorage {
            if (localStorage.trebis_key && localStorage.trebis_token) {
                return {
                    key: localStorage.trebis_key,
                    token: localStorage.trebis_token,
                }
            }
            return null;
        }

        public setLocalStorage(storage: ILocalStorage) {
            localStorage.setItem('trebis_key', storage.key);
            localStorage.setItem('trebis_token', storage.token);
        }

        public getCookie(name) {
            let matches = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'))
            return matches ? decodeURIComponent(matches[1]) : undefined
        }

        public getShortLink(): string {
            return document.location.pathname;
        }

        public async addHandler(e: Event): Promise<void> {
            e.preventDefault();
            if (!this._trebis) {
                this.trebisInit();
            }
            if (this._trebis) {
                const board = document.getElementById('board');
                if (board) {
                    const myCard = document.createElement('div');
                    myCard.id = 'trebis_add_newList';
                    myCard.style.position = 'absolute';
                    myCard.style.width = '100%';
                    myCard.style.height = '100%';
                    myCard.style.zIndex = '2';
                    myCard.innerHTML = '<div style="width: 100%; height: 100%;background: black; opacity: 0.5" class="trebis_close_newList"></div>' +
                        '<div style="position: absolute; top: 0;" class="js-add-list list-wrapper mod-add">' +
                        '<form>' +
                        `<input class="list-name-input trebis_new-listName" value="${Trebis.date()}" type="text" name="name" placeholder="Ввести заголовок списка" autocomplete="off" dir="auto" maxlength="512">` +
                        '<div class="list-add-controls u-clearfix">' +
                        '<input class="nch-button nch-button--primary mod-list-add-button js-save-edit trebis_new-listName-add" type="submit" value="Добавить список">' +
                        '<a class="icon-lg icon-close dark-hover js-cancel-edit trebis_close_newList_btn" href="#" aria-label="Отменить редактирование"></a>' +
                        '</div>' +
                        '</form>' +
                        '</div>';
                    board.prepend(myCard);

                    const close = (e: Event) => {
                        e.preventDefault();
                        const newList = document.getElementById('trebis_add_newList');
                        board.removeChild(newList);
                    }
                    const closeList: HTMLElement = document.querySelector('.trebis_close_newList');
                    const closeListBtn: HTMLElement = document.querySelector('.trebis_close_newList_btn');
                    closeList.onclick = close;
                    closeListBtn.onclick = close;

                    const addListBtn: HTMLElement = document.querySelector('.trebis_new-listName-add');
                    addListBtn.onclick = async (e: Event) => {
                        e.preventDefault();
                        e.stopPropagation();
                        await this._trebis.getBoardId(this.getShortLink());
                        const listName: HTMLInputElement = document.querySelector('.trebis_new-listName');
                        await this._trebis.createList(listName.value || Trebis.date());
                        close(e);
                    }
                }
            }
        }

        /**
         * Запуск обработчика, который создает список и прикрепляет карточки
         * @param e
         */
        public async runHandler(e: Event): Promise<void> {
            e.preventDefault();
            if (!this._trebis) {
                this.trebisInit();
            }
            if (this._trebis) {
                await this._trebis.getBoardId(this.getShortLink());
                // Добавляем список
                const lists: ITrelloListData[] = await this._trebis.trello.getLists(this._trebis.boardId);
                const thisListId = await this._trebis.getListId(lists, Trebis.date());
                if (thisListId === null) {
                    await this._trebis.createList();
                } else {
                    this._trebis.thisListId = thisListId;
                }
                // Обновляем карточки
                await this._trebis.initLabels();
                await this._trebis.updateCard();
            } else {
                this.openSettingModal();
            }
        }

        /**
         * Нажата кнопка настроек.
         * По факту этой кнопки быть не должно, но если она есть, значит не удалось получить токе из cookie
         * Поэтому даем пользователю возможность ввести ключ и токен вручную
         * @param e
         */
        public settingHandler(e: Event) {
            e.preventDefault();
            this.openSettingModal();
        }

        /**
         * Обработка для удаления старых карточек
         * @param e
         */
        public async removeHandler(e: Event) {
            e.preventDefault();
            let isRemoveLists = false;

            if (confirm('Уверены что хотите удалить старые карточки, при этом останутся первые 30 карточек?')) {
                if (confirm('Прям на все 100% уверены?')) {
                    isRemoveLists = true;
                }
            }

            if (isRemoveLists) {
                if (!this._trebis) {
                    this.trebisInit();
                }
                if (this._trebis) {
                    await this._trebis.getBoardId(this.getShortLink());
                    let lists: ITrelloListData[] = await this._trebis.trello.getLists(this._trebis.boardId);
                    await this._trebis.removeOldLists(lists);
                    lists = null;
                } else {
                    this.openSettingModal();
                }
            }
        }

        protected _revertDate(date: string, isInput: boolean = true, isRemoveYear: boolean = false): string {
            if (isInput) {
                return date.split('.').reverse().join('-')
            } else {
                let dateResult: any = date.split('-').reverse();

                dateResult[2] = (Number(dateResult[2]) - 2000);
                if (isRemoveYear) {
                    dateResult = dateResult.slice(0, 2);
                }

                return dateResult.join('.')
            }
        }

        protected _getTemplateResultForStat(statInfo: ITrebisStatistic): string {
            return `<p>Красных: <b>${statInfo.red}</b>шт.</p>` +
                `<p>Желтых: <b>${statInfo.yellow}</b>шт.</p>` +
                `<p>Синих: <b>${statInfo.blue}</b>шт.</p>` +
                `<p>Зеленых: <b>${statInfo.green}</b>шт.</p>`
        }

        /**
         * Обработка нажатия кнопки для получения статистики пользователя по доске
         * @param event
         */
        public statisticHandler(event: MouseEvent) {
            event.preventDefault();
            this.openModal(this.getTemplateContentForStat());
            this._statResQuery(false);
        }

        public openSettingModal() {
            let key = '';
            let token = '';
            const localStorage = this.getLocalStorage();
            if (localStorage) {
                key = localStorage.key;
                token = localStorage.token;
            }

            const content: string = '<div class="window-main-col" style="margin: 12px 40px 8px 56px;">' +
                '<span>Ключ и токен можно получить <a href="https://trello.com/app-key" target="_blank">тут</a></span>' +
                '<form action="#" id="trebis-data">' +
                '<div>' +
                '<label for="trebis-key">key</label>' +
                `<input type="text" id="trebis-key" style="width: 100%" value="${key}">` +
                '</div>' +
                '<div>' +
                '<label for="trebis-token">token</label>' +
                `<input type="text" id="trebis-token" style="width: 100%"  value="${token}">` +
                '</div>' +
                '<div>' +
                '<button class="nch-button--primary">Сохранить</button>' +
                '</div>' +
                '</form>' +
                '</div>';
            this.openModal(content);

            const trebisData: HTMLElement = document.getElementById('trebis-data');
            trebisData.onsubmit = (e) => {
                e.stopPropagation();
                const keyElement: HTMLElement = document.getElementById('trebis-key');
                const tokenElement: HTMLElement = document.getElementById('trebis-token');
                const data: ILocalStorage = {
                    // @ts-ignore
                    key: keyElement.value,
                    // @ts-ignore
                    token: tokenElement.value
                }
                this.setLocalStorage(data);
                this.closeModal();
            }
        }

        public openModal(content) {
            document.querySelector('body').classList.add('window-up');
            const trelloWindow: HTMLElement = document.querySelector('.window');
            if (trelloWindow) {
                trelloWindow.style.display = 'block';
                const windowWrapper = document.querySelector('.window-wrapper');
                windowWrapper.innerHTML = '<a class="icon-md icon-close dialog-close-button js-close-window" href="#"></a>';
                const windowContent = document.createElement('div');
                windowContent.classList.add('card-detail-window', 'u-clearfix');
                windowContent.innerHTML = content
                windowWrapper.append(windowContent);
                const dialogCloseButton: HTMLElement = document.querySelector('.dialog-close-button');
                if (dialogCloseButton) {
                    dialogCloseButton.onclick = this.closeModal.bind(this);
                }
                const windowOverlay: HTMLElement = document.querySelector('.window-overlay');
                if (windowOverlay) {
                    windowOverlay.onclick = (e: Event) => {
                        if (e.target === windowOverlay) {
                            this.closeModal();
                        }
                    }
                }
            }
        }

        public closeModal() {
            document.querySelector('body').classList.remove('window-up');
            const trelloWindow: HTMLElement = document.querySelector('.window');
            trelloWindow.style.display = 'none';
        }

        public createButtons() {
            const boardHeader = document.querySelector('.board-header');
            if (boardHeader && !boardHeader.querySelector('#trebis-buttons')) {
                const isTrebisToken = !!this.getCookie('token');
                let innerHtml = '<a class="board-header-btn" href="#" id="trebis-button-add" title="Нажмите, чтобы создать пустую карточку." aria-label="Создать пустую карточку"><span class="icon-sm icon-add board-header-btn-icon"></span></a>'
                innerHtml += '<a class="board-header-btn" href="#" id="trebis-button-run" title="Нажмите, чтобы автоматически создать карточку, и перенести все не выполненные задачи." aria-label="Запуск скрипта"><span class="icon-sm icon-card board-header-btn-icon"></span></a>'
                if (!isTrebisToken) {
                    innerHtml += '<a class="board-header-btn" href="#" id="trebis-button-setting" title="Нажмите, чтобы изменить свои данные." aria-label="Открытие настроек"><span class="icon-sm icon-gear board-header-btn-icon"></span></a>'
                }
                const memberMenu: HTMLElement = document.querySelector('.js-open-header-member-menu');
                let isShowDropButton = false;
                if (memberMenu) {
                    const userName = (memberMenu.title.match(/\(([^\)]+)\)/gi))[0]?.replace(/\(|\)/gi, '');
                    if (this.ADMIN_USERS.includes(userName)) {
                        isShowDropButton = true;
                    }

                }
                if (isShowDropButton) {
                    innerHtml += '<a class="board-header-btn" href="#" id="trebis-button-trash" title="Нажмите, чтобы удалить старые карточки." aria-label="Удаление старых карточек"><span class="icon-sm icon-trash board-header-btn-icon"></span></a>';
                }
                innerHtml += '<a class="board-header-btn" href="#" id="trebis-button-statistic" title="Нажмите, чтобы получить статистику." aria-label="Получение статистики"><span class="icon-sm icon-information board-header-btn-icon"></span></a>';
                const buttons = document.createElement('div');
                buttons.id = 'trebis-buttons';
                buttons.innerHTML = innerHtml;

                boardHeader.prepend(buttons);

                const addButton = document.getElementById('trebis-button-add');
                addButton.onclick = this.addHandler.bind(this);

                const runButton = document.getElementById('trebis-button-run');
                runButton.onclick = this.runHandler.bind(this);

                if (isShowDropButton) {
                    const trashButton = document.getElementById('trebis-button-trash');
                    trashButton.onclick = this.removeHandler.bind(this);
                }

                const statisticButton = document.getElementById('trebis-button-statistic');
                statisticButton.onclick = this.statisticHandler.bind(this);

                if (!isTrebisToken) {
                    const settingButton = document.getElementById('trebis-button-setting');
                    settingButton.onclick = this.settingHandler.bind(this);
                }
            }
        }

        protected getTemplateContentForStat(isFull: boolean = false): string {
            const oldDate = Date.now() - 3600 * 24 * 7 * 1000;
            const dateStart = Trebis.date(oldDate, true);
            const dateEnd = Trebis.date(null, true);

            const styleLink = 'margin-left: 10px; border-bottom: 1px dashed blue; cursor: pointer';

            let res = '<div class="window-main-col" style="margin: 12px 40px 8px 56px;">' +
                '<h2>Получение статистики:</h2>' +
                '<div style="display: flex">' +
                '<div>' +
                '<label for="trebis-key"> с</label>' +
                `<input type="date" id="trebis_date-start" style="width: 100%" value="${this._revertDate(dateStart)}">` +
                '</div>' +
                '<div style="margin-left: 15px">' +
                '<label for="trebis-token"> до</label>' +
                `<input type="date" id="trebis_date-end" style="width: 100%"  value="${this._revertDate(dateEnd)}">` +
                '</div>' +
                '<div style="margin-left: 35px">' +
                `<p id="trebis_date_week" style="${styleLink}">Последние 7 дней</p>` +
                `<p id="trebis_date_month" style="${styleLink}">Текущий месяц</p>` +
                `<p id="trebis_date_all" style="${styleLink}">За все время</p>` +
                '</div>' +
                '</div>' +
                '<div>' +
                '<button class="nch-button--primary trebis-statistic_btn">Построить</button>' +
                '</div>';

            if (isFull) {
                const year = (new Date()).getFullYear();
                res += '<div style="display: flex" class="trebis_get-server-data">';
                for (let i = year; i > 2018; i--) {
                    res += `<p style="${styleLink}">${i}</p>`;
                }
                res += '</div>';
            }

            res += '<div class="trebis-statistic_content" style="margin: 30px 0;"></div>' +
                '</div>';

            return res;
        }

        protected _getMonthText(month: number) {
            switch (month) {
                case 0:
                    return 'Январь';
                case 1:
                    return 'Февраль';
                case 2:
                    return 'Март';
                case 3:
                    return 'Апрель';
                case 4:
                    return 'Май';
                case 5:
                    return 'Июнь';
                case 6:
                    return 'Июль';
                case 7:
                    return 'Август';
                case 8:
                    return 'Сентябрь';
                case 9:
                    return 'Октябрь';
                case 10:
                    return 'Ноябрь';
                case 11:
                    return 'Декабрь';
            }
            return '';
        }

        protected _statisticFromServerTemplate(serverData: IServerApiRequest, year: string): string {
            let res = '';

            const serverDatas = serverData.data;

            for (const boardName in serverDatas) {
                if (serverDatas.hasOwnProperty(boardName)) {
                    res += '<div>' +
                        `<h3>Информация по доске: <b>${boardName}</b></h3><table>`;
                    const style = (color: string): string => {
                        return `border-bottom: 3px solid ${color}; border-radius: 4px`;
                    }
                    for (const month in serverDatas[boardName]) {
                        if (serverDatas[boardName].hasOwnProperty(month)) {
                            const data = serverDatas[boardName][month];
                            res += '<tr>' +
                                `<td>${this._getMonthText(Number(month))}</td>` +
                                `<td style="${style('red')}">${data.red}</td>` +
                                `<td style="${style('yellow')}">${data.yellow}</td>` +
                                `<td style="${style('green')}">${data.green}</td>` +
                                `<td style="${style('blue')}">${data.blue}</td>` +
                                '<tr>';
                        }
                    }
                    res += `<tr><td colspan="5">Итог за ${year}</td></tr>`;
                    const data = serverData.total[boardName];
                    res += '<tr>' +
                        '<td></td>' +
                        `<td style="${style('red')}">${data.red}</td>` +
                        `<td style="${style('yellow')}">${data.yellow}</td>` +
                        `<td style="${style('green')}">${data.green}</td>` +
                        `<td style="${style('blue')}">${data.blue}</td>` +
                        '</tr>';
                    res += '</table></div>';
                }
            }

            if (!res) {
                res = '<p style="color: red">На сервере нет сохраненных данных!</p>';
            }
            return `<div>${res}</div>`;
        }

        protected async _getStatisticFromServer(year: string): Promise<string> {
            const serverApi = new ServerApi();
            const statData = await serverApi.get(year);
            if (statData.status) {
                return this._statisticFromServerTemplate(statData.res, year);
            } else {
                return '<p style="color: red">Не удалось получить данные с сервера</p>';
            }
        }


        protected _statResQuery(isFull: boolean): void {
            const statRes = async (dateStart: string, dateEnd: string) => {
                if (!this._trebis) {
                    this.trebisInit();
                }
                if (this._trebis) {
                    await this._trebis.getBoardId(this.getShortLink());
                    const statInfo = await this._trebis.getStatistic(dateStart, dateEnd);
                    const statisticContent: HTMLElement = document.querySelector('.trebis-statistic_content');
                    if (statInfo) {
                        statisticContent.innerHTML = `<h4>Информация с ${dateStart} по ${dateEnd}</h4>` +
                            '<div>' + this._getTemplateResultForStat(statInfo) + '</div>';
                    } else {
                        statisticContent.innerText = '<p style="color: red">Произошла ошибка при получении доски</p>';
                    }
                } else {
                    this.openSettingModal();
                }
            }

            const statResFull = async (dateStart: string, dateEnd: string) => {
                if (!this._trebis) {
                    this.trebisInit();
                }
                if (this._trebis) {
                    const orgBoards: ITrelloOrg = await this._trebis.trello.getOrganizations('basecontrol');
                    const statisticContent: HTMLElement = document.querySelector('.trebis-statistic_content');
                    if (orgBoards && orgBoards.boards) {
                        statisticContent.innerHTML = '';
                        for (const board of orgBoards.boards) {
                            this._trebis.boardId = board.id;
                            const statInfo = await this._trebis.getStatistic(dateStart, dateEnd,
                                {
                                    boardName: board.name,
                                    isSaveOnServer: true
                                });
                            if (statInfo) {
                                statisticContent.innerHTML += '<div style="margin: 15px 0;">' +
                                    `<h3>Информация по доске: <u>${board.name}</u></h3>` +
                                    `<h4>Информация с ${dateStart} по ${dateEnd}</h4>` +
                                    '<div class="u-gutter">' +
                                    this._getTemplateResultForStat(statInfo) +
                                    '</div>' +
                                    '</div>';
                            } else {
                                statisticContent.innerText += `<p style="color: red">Произошла ошибка при получении доски <u>${board.name}</u></p>`;
                            }
                        }
                    } else {
                        statisticContent.innerHTML = '<span style="color:red">Произошла ошибка при получении информации о доске</span>';
                    }
                } else {
                    this.openSettingModal();
                }
            }

            const weekBtn: HTMLElement = document.getElementById('trebis_date_week');
            weekBtn.onclick = async (e: MouseEvent) => {
                e.preventDefault();
                const startTime = Date.now() - 3600 * 1000 * 24 * 7;
                let stat = statRes;
                if (isFull) {
                    stat = statResFull;
                }
                await stat(Trebis.date(startTime), Trebis.date());
            }
            const monthBtn: HTMLElement = document.getElementById('trebis_date_month');
            monthBtn.onclick = async (e: MouseEvent) => {
                e.preventDefault();
                let startDate = Trebis.date().split('.');
                startDate[0] = '01';
                let stat = statRes;
                if (isFull) {
                    stat = statResFull;
                }
                await stat(startDate.join('.'), Trebis.date());
            }
            const allBtn: HTMLElement = document.getElementById('trebis_date_all');
            allBtn.onclick = async (e: MouseEvent) => {
                e.preventDefault();
                let stat = statRes;
                if (isFull) {
                    stat = statResFull;
                }
                await stat('01.01.2019', Trebis.date());
            }
            const trebisStatRes: HTMLElement = document.querySelector('.trebis-statistic_btn');
            trebisStatRes.onclick = async (e: MouseEvent) => {
                e.preventDefault();

                const dateStart: HTMLInputElement = document.querySelector('#trebis_date-start');
                const dateEnd: HTMLInputElement = document.querySelector('#trebis_date-end');

                const startValue = this._revertDate(dateStart.value, false);
                const endValue = this._revertDate(dateEnd.value, false);
                let stat = statRes;
                if (isFull) {
                    stat = statResFull;
                }
                await stat(startValue, endValue);
            }
        }

        /**
         * Обработка нажатия кнопки для получения статистики по всем пользователям
         * @param event
         */
        public statisticOrgHandler(event: MouseEvent) {
            event.preventDefault();
            this.openModal(this.getTemplateContentForStat(true));

            const trebisServerData: HTMLElement = document.querySelector('.trebis_get-server-data');
            trebisServerData.onclick = async (e: MouseEvent) => {
                e.preventDefault();
                if (e.target) {
                    const statisticContent: HTMLElement = document.querySelector('.trebis-statistic_content');
                    // @ts-ignore
                    statisticContent.innerHTML = await this._getStatisticFromServer(e.target.innerText);
                }
            }

            this._statResQuery(true);
        }

        public createOrgButtons() {
            const boardHeader = document.querySelector('#header');
            if (boardHeader && !boardHeader.querySelector('#trebis_admin-buttons')) {
                const isTrebisToken = !!this.getCookie('token');
                let innerHtml = '<a class="board-header-btn" href="#" id="trebis_admin-button-statistic" title="Нажмите, чтобы получить статистику." aria-label="Получение статистики"><span class="icon-sm icon-information board-header-btn-icon"></span></a>';
                if (!isTrebisToken) {
                    innerHtml += '<a class="board-header-btn" href="#" id="trebis-button-setting" title="Нажмите, чтобы изменить свои данные." aria-label="Открытие настроек"><span class="icon-sm icon-gear board-header-btn-icon"></span></a>'
                }
                const buttons = document.createElement('div');
                buttons.id = 'trebis_admin-buttons';
                buttons.innerHTML = innerHtml;

                boardHeader.prepend(buttons);

                const statisticButton = document.getElementById('trebis_admin-button-statistic');
                statisticButton.onclick = this.statisticOrgHandler.bind(this);

                if (!isTrebisToken) {
                    const settingButton = document.getElementById('trebis-button-setting');
                    settingButton.onclick = this.settingHandler.bind(this);
                }
            }
        }
    }

    /**
     * Сравниваем даты
     * @param date1
     * @param date2
     * @private
     */
    function isEqualDate(date1: Date, date2: Date) {
        // Можно конечно сделать проверку date1 >= date2 && date2 >= date1,
        // но по производительности мой вариант немного быстрее
        return (date1.getDate() === date2.getDate() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getFullYear() === date2.getFullYear());
    }

    /**
     * Пытаемся распарсить строку с датой. При успехе вернется объект Date иначе null
     * @param date
     * @private
     */
    function getDate(date: string): Date {
        // Кто-то заполнял календарь вида 21,03 или 21/03 поэтому на всякий случай обрабатываем это
        date = date.replace(/,|\//g, '.');
        /**
         * Есть проблема, когда указан диапазон дат.
         * В таком случае возвращаем только последнюю дату
         */
        if (date.includes('.') && date.includes('-')) {
            const parseDates = date.split('-');
            let res: Date = null;
            parseDates.forEach((parseDate) => {
                res = getDate(parseDate);
            })
            return res;
        }

        let dateValues: any[] = date.split(date.includes('.') ? '.' : '-');

        if (dateValues[0] === undefined && dateValues[1] === undefined) {
            return null;
        }

        for (let i = 0; i < dateValues.length; i++) {
            dateValues[i] = Number(dateValues[i]);
            if (isNaN(dateValues[i])) {
                return null;
            }
        }
        // Если год не указан, то предполагаем что используется текущий год
        if (dateValues.length < 3) {
            dateValues.push((new Date).getFullYear());
        }
        // значение месяца уменьшаем на 1, иначе дата определится не корректно
        dateValues[1]--;

        if (dateValues[2] < 2000) {
            dateValues[2] += 2000;
        }

        return new Date(dateValues[2], dateValues[1], dateValues[0]);
    }

    /**
     * Подготавливаем приложение для доски пользователя
     */
    export function initForUserBoard() {
        const app = new Application();
        app.createButtons();
        const observer = new MutationObserver(app.createButtons.bind(app));
        observer.observe(document.querySelector('.board-header'), {
            childList: true,
            subtree: true
        });
    }

    /**
     * Подготавливаем приложение для отображения общей статистики
     * Запускается на странице basecontrol
     */
    export function initForOrgBoards() {
        const app = new Application();
        app.createOrgButtons();
        const observer = new MutationObserver(app.createOrgButtons.bind(app));
        observer.observe(document.querySelector('#header'), {
            childList: true,
            subtree: true
        });
    }
}

window.onload = () => {
    /**
     * Ждем пока страница полностью загрузится.
     * При этом проверяем что есть имя доски
     */
    if (document.location.host === 'trello.com') {
        const run = () => {
            /**
             * Выполняется на личной карточке пользователя
             */
            if (document.querySelector('.board-name-input')) {
                if (!document.getElementById('trebis-buttons')) {
                    TREBIS.initForUserBoard();
                }
            }
            /**
             * Выполняется на разводящей карточке
             */
            if (document.location.pathname.includes('basecontrol')) {
                if (!document.getElementById('trebis_admin-buttons')) {
                    TREBIS.initForOrgBoards();
                }
            }
        }

        run();

        /**
         * Не понятно как отслеживать изменение url, поэтому просто отслеживаем изменения в title
         */
        const observer = new MutationObserver(run);
        observer.observe(document.querySelector('title'), {
            childList: true
        });
    }
}
