export interface IRequestSend {
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

export interface IGetParams {
    [key: string]: string;
}

export interface IServerApiData {
    name?: string;
    data?: {
        [year: string]: {
            [month: string]: {
                [day: string]: ITrebisStatistic
            }
        }
    }
}

export interface IServerApiRequestData {
    [boardName: string]: {
        [month: string]: ITrebisStatistic
    }
}

export interface IServerApiRequestTotal {
    [boardName: string]: ITrebisStatistic;
}

export interface IServerApiRequestRes {
    data: IServerApiRequestData;
    total: IServerApiRequestTotal;
}

export interface IServerApiRequest {
    status: boolean;
    res?: IServerApiRequestRes;
    msg?: string;
}

export interface ITrelloOrg {
    boards: ITrelloListData[];
}

export interface ITrelloData {
    key?: string;
    token?: string;

    [key: string]: any;
}

export interface ITrelloListData {
    id?: string;
    name?: string;
    cards?: ITrelloCardData[];

    [key: string]: any;
}

export interface ITrelloLabel {
    color: string;
    id: string;
}

export interface ITrelloCardData {
    id?: string;
    name?: string;
    desc?: string;
    labels?: ITrelloLabel[];

    [key: string]: any;
}

export interface ITrebisListId {
    id: string;
    index: number;
}

export interface ITrebisLabel {
    [color: string]: string;
}

export interface ILocalStorage {
    key: string;
    token: string;
}

export interface ITrebisStatistic {
    red: number;
    yellow: number;
    blue: number;
    green: number;
}

export interface ITrebisStatisticText {
    red: string | number;
    yellow: string | number;
    blue: string | number;
    green: string | number;
}

export interface ITrelloUIButton {
    id: string;
    title: string;
    label: string;
    icon: string;
}

export interface ITrelloUiCallback {
    id?: string;
    'class'?: string;
    callback: () => {};
}

export interface IDateRange {
    start: string;
    end: string;
}
