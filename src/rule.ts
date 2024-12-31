import {arrayToObject, mapObjectValues, omitObjectKeys} from '@augment-vir/common';
import {
    type AnyRuleModule,
    type Linter,
    type RuleContext,
    type RuleListener,
    type RuleMetaData,
} from '@typescript-eslint/utils/ts-eslint';

export type MessageIds<Messages extends Record<string, string>> = {
    [MessageId in keyof Messages]: MessageId;
};

export type Rule<Messages extends Record<string, string> = Record<string, string>> = {
    name: string;
    messageIds: MessageIds<Messages>;
} & AnyRuleModule;

export function defineRule<const Messages extends Record<string, string>>(
    name: string,
    messages: Messages,
    create: (params: {
        ruleName: string;
        messageIds: MessageIds<Messages>;
        context: Readonly<RuleContext<string, ReadonlyArray<unknown>>>;
    }) => RuleListener,
    meta?: Omit<RuleMetaData<string>, 'messages'>,
): Rule<Messages> {
    const messageIds = mapObjectValues(messages, (messageId) => messageId) as {
        [MessageId in keyof Messages]: MessageId;
    };

    return {
        messageIds,
        name,
        defaultOptions: [],
        create(context) {
            return create({ruleName: name, messageIds, context});
        },
        meta: {
            ...meta,
            messages: messages as Record<string, string>,
        } as AnyRuleModule['meta'],
    };
}

export function createRules(
    rules: ReadonlyArray<Readonly<Rule>>,
): Required<Linter.Plugin>['rules'] {
    return arrayToObject(rules, (rule) => {
        return {
            key: rule.name,
            value: omitObjectKeys(rule, [
                'name',
                'messageIds',
            ]),
        };
    }) as Required<Linter.Plugin>['rules'];
}
