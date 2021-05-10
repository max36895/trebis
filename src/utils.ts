import {IDateRange} from "./interfaces";

export namespace TREBIS {
    /**
     * Сравниваем даты
     * @param date1
     * @param date2
     * @private
     */
    export function isEqualDate(date1: Date, date2: Date) {
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
    export function getDate(date: string): Date {
        // Кто-то заполнял календарь вида 21,03 или 21/03 поэтому на всякий случай обрабатываем это
        date = date.replace(/,|\//g, '.');
        /**
         * Есть проблема, когда указан диапазон дат.
         * В таком случае возвращаем только последнюю определенную дату
         */
        if (date.includes('.') && date.includes('-')) {
            const parseDates = date.split('-');
            let res: Date = null;
            parseDates.forEach((parseDate) => {
                const date = getDate(parseDate);
                if (date) {
                    res = date;
                }
            });
            return res;
        }

        const dateValues: any[] = date.split(date.includes('.') ? '.' : '-');

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
            dateValues.push((new Date()).getFullYear());
        }
        // значение месяца уменьшаем на 1, иначе дата определится не корректно
        dateValues[1]--;

        if (dateValues[2] < 2000) {
            dateValues[2] += 2000;
        }

        return new Date(dateValues[2], dateValues[1], dateValues[0]);
    }


    /**
     * Получение корректной даты в формате d.m.Y
     * @param time
     * @param isFullYear
     */
    export function date(time: number = null, isFullYear: boolean = false): string {
        if (time === null) {
            time = Date.now();
        }
        const date = new Date(time);
        const day = date.getDate();
        const month = date.getMonth() + 1;

        let result;
        if (day < 10) {
            result = `0${day}`;
        } else {
            result = day + '';
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

    /**
     * Преобразование даты из d.m.Y в Y-m-d и наоборот
     * @param date
     * @param isInput
     * @param isRemoveYear
     */
    export function revertDate(date: string, isInput: boolean = true, isRemoveYear: boolean = false): string {
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

    /**
     * Проверка на наличие ссылки в тексте
     * @param text
     */
    export function isLink(text: string): boolean {
        if (text) {
            return !!text.match(/((http|s:\/\/)[^( |\n)]+)/umig);
        }
        return false;
    }

    /**
     * Получение даты начала и конца текущего месяца. В качестве конца месяца выбирается текущая дата.
     */
    export function getThisMonth(): IDateRange {
        const startDate = date().split('.');
        startDate[0] = '01';

        return {
            start: startDate.join('.'),
            end: date()
        }
    }

    /**
     * Получение даты начала и конца предыдущего месяца.
     */
    export function getOldMonth(): IDateRange {
        const oldMonth: Date = new Date();
        const startDate = date(oldMonth.setMonth(oldMonth.getMonth() - 1)).split('.');
        startDate[0] = '01';
        const dateEnd = new Date(oldMonth.getFullYear(), oldMonth.getMonth() + 1, 0);

        return {
            start: startDate.join('.'),
            end: date(dateEnd.setMilliseconds(0))
        }
    }

    export function getDayInSec(day: number): number {
        return 3600 * 24 * 1000 * day;
    }

    export function downloadAsFile(fileName: string, data: string, options: BlobPropertyBag = {type: 'application/json'}) {
        const a = document.createElement("a");
        const file = new Blob([data], options);
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
    }
}
