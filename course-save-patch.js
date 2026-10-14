/* Pure patch builder: never send unchanged lesson bodies on autosave.
   This file has no browser dependencies and is also tested in Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CMCCoursePatch = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const COURSE_FIELDS = ['title','subtitle','slug','description','stage_key','access_mode','navigation_mode','estimated_minutes','status'];
  const MODULE_FIELDS = ['id','title','description','position'];
  const LESSON_FIELDS = [
    'id','module_id','title','summary','lesson_type','content','video_url','image_url',
    'image_alt','resource_url','resource_label','reflection_prompt',
    'response_required','estimated_minutes','is_required','position'
  ];

  function select(fields, item) {
    const picked = {};
    fields.forEach(function (key) { if (item[key] !== undefined) picked[key] = item[key]; });
    return picked;
  }

  function rows(payload) {
    const modules = [];
    const lessons = [];
    (payload?.modules || []).forEach(function (module, index) {
      modules.push(select(MODULE_FIELDS, Object.assign({}, module, { position:index })));
      (module.lessons || []).forEach(function (lesson, position) {
        lessons.push(select(LESSON_FIELDS, Object.assign({}, lesson, {
          module_id:module.id, position:position
        })));
      });
    });
    return { modules:modules, lessons:lessons };
  }

  function byId(items) {
    const index = new Map();
    items.forEach(function (item) {
      if (!item.id || index.has(item.id)) throw new Error('Duplicate or missing course item ID.');
      index.set(item.id, item);
    });
    return index;
  }

  function changed(before, after) {
    return JSON.stringify(before) !== JSON.stringify(after);
  }

  function diff(before, after, expectedRevision) {
    if (!after?.id) throw new Error('A course ID is required to save safely.');
    const revision = Number(expectedRevision);
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid course version.');
    const oldCourse = before ? select(COURSE_FIELDS, before) : {};
    const newCourse = select(COURSE_FIELDS, after);
    const fields = {};
    COURSE_FIELDS.forEach(function (key) {
      if (!before || changed(oldCourse[key], newCourse[key])) fields[key] = newCourse[key];
    });
    const oldRows = rows(before);
    const newRows = rows(after);

    const patch = {
      save_version:2,
      id:after.id,
      expected_revision:revision,
      course:fields,
      modules_upsert:[],
      lessons_upsert:[],
      module_ids_to_delete:[],
      lesson_ids_to_delete:[]
    };

    [['modules','modules_upsert','module_ids_to_delete'],
      ['lessons','lessons_upsert','lesson_ids_to_delete']].forEach(function (entry) {
      const previous = byId(oldRows[entry[0]]);
      const next = byId(newRows[entry[0]]);
      next.forEach(function (item,id) {
        if (!previous.has(id) || changed(previous.get(id), item)) patch[entry[1]].push(item);
      });
      previous.forEach(function (_,id) {
        if (!next.has(id)) patch[entry[2]].push(id);
      });
    });
    return patch;
  }

  function hasChanges(patch) {
    return Object.keys(patch.course || {}).length > 0
      || patch.modules_upsert.length > 0
      || patch.lessons_upsert.length > 0
      || patch.module_ids_to_delete.length > 0
      || patch.lesson_ids_to_delete.length > 0;
  }

  return { COURSE_FIELDS:COURSE_FIELDS, MODULE_FIELDS:MODULE_FIELDS, LESSON_FIELDS:LESSON_FIELDS, diff:diff, hasChanges:hasChanges };
});
