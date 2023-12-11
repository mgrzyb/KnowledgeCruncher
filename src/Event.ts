export interface IEvent<TArgs extends unknown[]> {
    once(listener: (...args: TArgs) => void): void;
    addListener(listener: (...args: TArgs) => void): () => void;
}

export class Event<TArgs extends unknown[]> {
    private readonly listeners: ((...args: TArgs) => void)[] = [];

    addListener(listener: (...args: TArgs) => void) {
        this.listeners.push(listener);
        return () => this.listeners.splice(this.listeners.indexOf(listener), 1);
    }

    once(listener: (...args: TArgs) => void) {
        const d = this.addListener((...args) => {
            listener(...args);
            d();
        });
        return d;
    }

    emit(...args: TArgs) {
        for (const l of this.listeners) {
            l(...args);
        }
    }
}
