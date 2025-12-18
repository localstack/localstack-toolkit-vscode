// write a test for isAuthTokenPresent function in src/utils/authenticate.ts
import * as assert from "node:assert";

import { isAuthTokenPresent } from "../utils/authenticate.ts";

suite("Authenticate Test Suite", () => {
    test("returns true for valid auth object", () => {
        const authObject = { LOCALSTACK_AUTH_TOKEN: "some-token" };
        assert.strictEqual(isAuthTokenPresent(authObject), true);
    });     

    test("returns false for null", () => {
        assert.strictEqual(isAuthTokenPresent(null), false);
    });

    test("returns false forq non-object", () => {
        assert.strictEqual(isAuthTokenPresent("string"), false);
        assert.strictEqual(isAuthTokenPresent(123), false);
        assert.strictEqual(isAuthTokenPresent(undefined), false);
    });

    test("returns false for object without auth token key", () => {
        const authObject = { someKey: "some-value" };
        assert.strictEqual(isAuthTokenPresent(authObject), false);
    });

    // test("returns false for object with non-string auth token", () => {
    //     const authObject1 = { LOCALSTACK_AUTH_TOKEN: 12345 };
    //     const authObject2 = { LOCALSTACK_AUTH_TOKEN: null };
    //     assert.strictEqual(isAuthTokenPresent(authObject1), false);
    //     assert.strictEqual(isAuthTokenPresent(authObject2), false);
    // });

});