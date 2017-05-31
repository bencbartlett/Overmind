import {assert} from "chai";
import * as _ from "lodash";

describe("lodash", () => {

  it("the global should exist", () => {
    assert.isNotNull(_);
  });

  it("map should exist", () => {
    assert.isNotNull(_.map);
  });

});
