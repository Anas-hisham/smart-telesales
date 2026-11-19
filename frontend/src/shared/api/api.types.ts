/** One page of a long list (the server paginates it). */
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
