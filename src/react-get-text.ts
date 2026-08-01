interface ReactLikeObject {
    props?: {
        children?: ReactLikeObject | ReactLikeObject[] | string;
    };
}

// given a react object extract the textual strings from it - like jquery's $(element).text(). TODO: Aim to remove this
export function react_get_text(element: unknown): string {
    function walk(object: unknown, iterator: (value: unknown, object: unknown) => void): void {
        const obj = object as ReactLikeObject;
        if (obj && obj.props && obj.props.children) {
            ([] as unknown[]).concat(obj.props.children).forEach((value) => {
                iterator(value, obj);
                walk(value, iterator);
            });
        }
    }

    let str = '';
    walk(element, (obj: unknown) => {
        if (typeof obj === 'string') str += obj;
    });
    return str;
}
