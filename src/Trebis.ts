import {TrelloApi} from "./api/TrelloApi";
import {ServerApi} from "./api/ServerApi";
import {TREBIS as utils} from "./utils";
import {TrelloUI} from "./TrelloUI";
import {IServerApiData, ITrebisLabel, ITrebisStatistic, ITrelloCardData, ITrelloListData} from "./interfaces";

export class Trebis {
    public static ORG_NAME = 'basecontrol';
    public trello: TrelloApi;

    protected labels: ITrebisLabel = null;

    public boardId: string = null;
    public thisListId: string = null;
    protected lastListId: string = null;

    public constructor(key: string = null, token: string = null) {
        this.trello = new TrelloApi();
        this.initKeyToken(key, token);
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
             * Поэтому получаем все доски организации и ищем нужную доску.
             * + в том, что можно залезть в чужую доску и работать с ней
             */
            boards = await this.trello.getOrganizations(Trebis.ORG_NAME);
            if (boards) {
                boards.boards.forEach((board) => {
                    if (shortLink.includes(board.shortLink)) {
                        this.boardId = board.id;
                    }
                });
            }
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
            });
        } else {
            this._logs('initLabels(): Не указан идентификатор доски');
        }
    }

    public async createList(name?: string): Promise<boolean> {
        this.thisListId = null;
        if (this.boardId) {
            const result = await this.trello.addList({idBoard: this.boardId, name});
            if (result.status && result.data) {
                this.thisListId = result.data.id || null;
                return true;
            }
        } else {
            this._logs('createList(): Не указан идентификатор доски');
        }
        return false;
    }

    /**
     * Получаем ид списка
     * @param lists
     * @param name
     */
    public getListId(lists: ITrelloListData[], name: string): string {
        const parseName: Date = utils.getDate(name);
        for (const list of lists) {
            const parseListName = utils.getDate(list.name);
            if (name === list.name ||
                ((parseListName && parseName) && utils.isEqualDate(parseListName, parseName))) {
                return list.id;
            }
        }
        return null;
    }

    /**
     * Получаем ид списка для текущей даты. Если списка нет, то создаем его.
     * Также получаем ид списка с предыдущей даты
     *
     * При этом для оптимизации, ищем список за последние 25 дней.
     *
     * @param lists
     * @protected
     */
    protected async initListId(lists: ITrelloListData[]): Promise<void> {
        if (!this.thisListId) {
            this.thisListId = await this.getListId(lists, utils.date());
            if (this.thisListId) {
                await this.createList();
            }
        }

        let day = 1;
        do {
            const name: string = utils.date(Date.now() - utils.getDayInSec(day));
            this.lastListId = await this.getListId(lists, name);
            day++;
            if (day > 25) {
                break;
            }
        } while (!this.lastListId);
    }

    public async createCard(data, labels, copyCardId?: string): Promise<void> {
        const req = await this.trello.copyCard(data, copyCardId);
        const cardId = req.data.id || null;
        if (cardId) {
            for (const label of labels) {
                await this.trello.addLabels(cardId, label);
            }
        } else {
            this._logs('CreateCard(): Не удалось создать карточку');
        }
    }

    public async updateCard(): Promise<number> {
        if (this.boardId) {
            const lists: ITrelloListData[] = await this.trello.getLists(this.boardId);
            await this.initListId(lists);
            let cardCount = 0;

            if (this.lastListId) {
                const thisCards: ITrelloCardData[] = await this.trello.getCards(this.thisListId);
                const lastCards: ITrelloCardData[] = await this.trello.getCards(this.lastListId);

                for (let lastCard of lastCards) {
                    const data = {
                        name: lastCard.name,
                        desc: lastCard.desc
                    };
                    if (data.name) {
                        const names = data.name.split(' ');
                        names.forEach((name) => {
                            if (utils.isLink(name) && !data.desc.includes(name)) {
                                data.desc = `[Ссылка на задачу](${name})\n${data.desc}`;
                            }
                        });
                    }
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
                            await this.createCard(data, addedLabels, lastCard.id);
                            await this.trello.addLabels(lastCard.id, this.labels.red);
                            cardCount++;
                        }
                    }
                }
                return cardCount;
            } else {
                this._logs('updateCard(): Не удалось найти карточку за предыдущий рабочий день');
            }
        } else {
            this._logs('updateCard(): Не указан идентификатор доски');
        }
        return null;
    }

    /**
     * Удаление старых списков. Как правильнее сделать не понятно. Поэтому временно оставлю как есть
     * @param lists
     */
    public async removeOldLists(lists: ITrelloListData[]): Promise<number> {
        let day = 30;
        let count = 0;
        // todo придумать как сделать сейчас не понятно как корректно отфильтровать и удалять карточки
        // Сейчас оставляю первые 30 карточек + может быть бага с годами...
        lists.forEach((list) => {
            if (day === 0) {
                this.trello.deleteList(list.id);
                count++;
            } else {
                day--;
            }
        });
        return count
    }

    private getCorrectDate(oldDate: Date, thisDate: Date): Date {
        if (oldDate === null && thisDate === null) {
            return null
        }
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
            this._logs('getStatistic(): Не указан идентификатор доски');
            return null;
        }
        const lists: ITrelloListData[] = await this.trello.getLists(this.boardId);
        await this.initLabels();
        const res = {
            red: 0,
            yellow: 0,
            blue: 0,
            green: 0
        };
        let isStart = false;

        const startDate: Date = utils.getDate(startValue);
        const endDate: Date = utils.getDate(endValue);
        let oldListDate: Date = null;
        let serverApiData: IServerApiData = {
            name: null,
            data: {}
        };

        for (const list of lists) {
            let listDate: Date = utils.getDate(list.name);
            if (oldListDate && listDate) {
                listDate = this.getCorrectDate(oldListDate, listDate);
            }
            if (oldListDate && oldListDate < listDate) {
                // Если в дате есть год, то все оставляем как есть.
                // Если год не указан, то по умолчанию ставится текущий год, поэтому вычитаем 1 год
                if (list.name.split(list.name.includes('.') ? '.' : '-').length < 3) {
                    listDate.setFullYear(oldListDate.getFullYear() - 1);
                }
            }
            if (list.name === endValue || ((endDate && listDate) && (listDate <= endDate))) {
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
                                // todo Продумать корректное поведение.
                                // Если не удалось получить дату, а метки есть, они уходят в никуда...
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

            if (list.name === startValue || ((startDate && listDate) && utils.isEqualDate(startDate, listDate))) {
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

    private _logs(error: string): void {
        console.warn(error);
        TrelloUI.errorNotification('Trebis.' + error);
    }
}
