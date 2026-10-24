/* Shared, HTML-safe lesson content codec for both the browser and Netlify.
   Legacy lessons remain Markdown. New WYSIWYG lessons store a validated Quill Delta
   in the existing text column; pasted HTML is never saved or rendered directly. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CMCLessonContent = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const PREFIX = 'cmc:delta:v1:';
  const LESSON_PREFIX = 'cmc:lesson:v1:';
  const LESSON_FORMATS = ['article','video','image','reflection','resource'];
  const MAX_LENGTH = 50000;
  const MAX_OPERATIONS = 8000;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character];
    });
  }

  function safeUrl(value, image) {
    const url = String(value == null ? '' : value).trim();
    if (!url || url.length > 2048 || /[\u0000-\u0020\u007f\\<>"']/.test(url)) return '';
    if (/^\/(?!\/)/.test(url)) return url;
    if (!image && /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(url)) return url;
    if (!/^(https?:)\/\//i.test(url) || (image && !/^https:\/\//i.test(url))) return '';
    try {
      const parsed = new URL(url);
      if (!parsed.hostname || !['http:','https:'].includes(parsed.protocol)) return '';
      return url;
    } catch (_) {
      return '';
    }
  }

  function normalizeAttributes(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    const result = {};
    ['bold','italic','underline'].forEach(function (name) {
      if (input[name] === true) result[name] = true;
    });
    const header = Number(input.header);
    if (header === 1) result.header = 2;
    else if ([2,3,4].includes(header)) result.header = header;
    if (input.blockquote === true) result.blockquote = true;
    if (input.list === 'bullet' || input.list === 'ordered') result.list = input.list;
    if (Number.isInteger(input.indent) && input.indent >= 1 && input.indent <= 4) {
      result.indent = input.indent;
    }
    const link = safeUrl(input.link, false);
    if (link) result.link = link;
    return result;
  }

  function normalizeOperations(operations) {
    if (!Array.isArray(operations) || operations.length > MAX_OPERATIONS) {
      throw new Error('The lesson text is not in a supported format.');
    }
    let length = 0;
    return operations.map(function (operation) {
      if (!operation || typeof operation !== 'object' || !Object.prototype.hasOwnProperty.call(operation, 'insert')) {
        throw new Error('The lesson text contains an invalid formatting operation.');
      }
      let insert;
      if (typeof operation.insert === 'string') {
        insert = operation.insert;
        length += insert.length;
      } else if (operation.insert && typeof operation.insert === 'object'
        && typeof operation.insert.image === 'string') {
        const image = safeUrl(operation.insert.image, true);
        if (!image) throw new Error('Lesson images must use secure HTTPS links or a site-relative path.');
        insert = { image:image };
        length += image.length;
      } else {
        throw new Error('The lesson includes an unsupported embedded item.');
      }
      if (length > MAX_LENGTH) throw new Error('Written content exceeds the 50,000-character limit.');
      const attributes = normalizeAttributes(operation.attributes);
      return Object.keys(attributes).length ? { insert:insert, attributes:attributes } : { insert:insert };
    });
  }

  function isRichText(value) {
    return typeof value === 'string' && value.startsWith(PREFIX);
  }

  function readDelta(value) {
    if (!isRichText(value)) throw new Error('Not a formatted lesson.');
    let operations;
    try {
      operations = JSON.parse(value.slice(PREFIX.length));
    } catch (_) {
      throw new Error('The lesson text could not be read. Please contact an administrator.');
    }
    return { ops:normalizeOperations(operations) };
  }

  function serializeDelta(operations) {
    const ops = normalizeOperations(operations);
    const containsContent = ops.some(function (operation) {
      return typeof operation.insert === 'string'
        ? Boolean(operation.insert.replace(/\s/g, ''))
        : Boolean(operation.insert.image);
    });
    if (!containsContent) return '';
    const saved = PREFIX + JSON.stringify(ops);
    if (saved.length > MAX_LENGTH) {
      throw new Error('Written content exceeds the 50,000-character limit. Shorten the lesson before saving.');
    }
    return saved;
  }

  function validateBody(value) {
    const content = String(value == null ? '' : value).trim();
    if (!isRichText(content)) return content.slice(0, MAX_LENGTH);
    if (content.length > MAX_LENGTH) {
      throw new Error('Written content exceeds the 50,000-character limit.');
    }
    return serializeDelta(readDelta(content).ops);
  }

  // Preserve the original lesson_type database value for older clients. Additional
  // format choices are versioned alongside the lesson body in the existing TEXT field.
  // No migration, progress reset, or rewrite of untouched Markdown lessons is needed.
  function normalizeFormats(formats) {
    if (!Array.isArray(formats) || !formats.length || formats.length > 25 ||
        formats.some(function (format) { return !LESSON_FORMATS.includes(format); })) {
      throw new Error('Select at least one supported lesson format.');
    }
    return LESSON_FORMATS.filter(function (format) { return formats.includes(format); });
  }

  function isLessonEnvelope(value) {
    return typeof value === 'string' && value.startsWith(LESSON_PREFIX);
  }

  function readLesson(value) {
    const stored = String(value == null ? '' : value);
    if (!isLessonEnvelope(stored)) return { content:stored, formats:null };
    if (stored.length > MAX_LENGTH) throw new Error('Lesson content exceeds the 50,000-character limit.');
    let parsed;
    try { parsed = JSON.parse(stored.slice(LESSON_PREFIX.length)); }
    catch (_) { throw new Error('The lesson format settings could not be read.'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
        typeof parsed.content !== 'string' || isLessonEnvelope(parsed.content)) {
      throw new Error('The lesson format settings are invalid.');
    }
    return { content:parsed.content, formats:normalizeFormats(parsed.formats) };
  }

  function lessonBody(value) {
    return readLesson(value).content;
  }

  function lessonFormats(value, lesson) {
    const parsed = readLesson(value);
    if (parsed.formats) return parsed.formats;
    const inferred = [];
    const legacyType = lesson && lesson.lesson_type;
    if (LESSON_FORMATS.includes(legacyType)) inferred.push(legacyType);
    if (parsed.content.trim()) inferred.push('article');
    if (lesson && lesson.video_url) inferred.push('video');
    if (lesson && lesson.image_url) inferred.push('image');
    if (lesson && (lesson.reflection_prompt || lesson.response_required)) inferred.push('reflection');
    if (lesson && lesson.resource_url) inferred.push('resource');
    return normalizeFormats(inferred.length ? inferred : ['article']);
  }

  function serializeLesson(formats, body) {
    const normalized = normalizeFormats(formats);
    const content = validateBody(body);
    if (isLessonEnvelope(content)) throw new Error('Nested lesson formats are not supported.');
    const stored = LESSON_PREFIX + JSON.stringify({ formats:normalized, content:content });
    if (stored.length > MAX_LENGTH) throw new Error('Lesson content exceeds the 50,000-character limit.');
    return stored;
  }

  function validateContent(value) {
    const stored = String(value == null ? '' : value).trim();
    if (!isLessonEnvelope(stored)) return validateBody(stored);
    const parsed = readLesson(stored);
    return serializeLesson(parsed.formats, parsed.content);
  }

  function inlineMarkdown(value) {
    const links = [];
    const linked = String(value || '').replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, function (_, text, url) {
      const token = 'CMC_LINK_' + links.length + '_TOKEN';
      links.push({ token:token, text:text, url:url });
      return token;
    });
    let html = escapeHtml(linked)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    links.forEach(function (link) {
      const href = safeUrl(link.url, false);
      html = html.replace(link.token, href
        ? '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(link.text) + '</a>'
        : escapeHtml(link.text));
    });
    return html;
  }

  function renderMarkdown(value) {
    const lines = String(value || '').split(/\n/);
    let html = '';
    let listType = '';
    function closeList() {
      if (listType) html += '</' + listType + '>';
      listType = '';
    }
    lines.forEach(function (raw) {
      const line = raw.trim();
      if (line.startsWith('- ')) {
        if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
        html += '<li>' + inlineMarkdown(line.slice(2)) + '</li>';
        return;
      }
      if (/^\d+\.\s+/.test(line)) {
        if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; }
        html += '<li>' + inlineMarkdown(line.replace(/^\d+\.\s+/, '')) + '</li>';
        return;
      }
      if (!line) return;
      closeList();
      if (line === '---') html += '<hr>';
      else if (line.startsWith('### ')) html += '<h4>' + inlineMarkdown(line.slice(4)) + '</h4>';
      else if (line.startsWith('## ')) html += '<h3>' + inlineMarkdown(line.slice(3)) + '</h3>';
      else if (line.startsWith('> ')) html += '<blockquote>' + inlineMarkdown(line.slice(2)) + '</blockquote>';
      else html += '<p>' + inlineMarkdown(line) + '</p>';
    });
    closeList();
    return html;
  }


  // Reflection prompts are plain text stored in the existing lesson column.
  // Interpret *only* emphasis markers; never inject author-supplied HTML,
  // links, attributes or scripts. The presentation uses white-space:pre-wrap
  // so original single and blank lines remain visible exactly as typed.
  function renderReflectionPrompt(value) {
    const raw = String(value == null ? '' : value).replace(/\r\n?/g, '\n');
    const formats = [
      ['***', '<strong><em>', '</em></strong>'],
      ['___', '<strong><em>', '</em></strong>'],
      ['**', '<strong>', '</strong>'],
      ['__', '<strong>', '</strong>'],
      ['*', '<em>', '</em>'],
      ['_', '<em>', '</em>']
    ];
    function closingAt(source, delimiter, after) {
      for (let index = after; index <= source.length - delimiter.length; index++) {
        if (source[index] === '\\') { index++; continue; }
        if (source.startsWith(delimiter, index)) return index;
      }
      return -1;
    }
    function inline(source) {
      let result = '';
      for (let i = 0; i < source.length;) {
        if (source[i] === '\\' && /[*_\\]/.test(source[i + 1] || '')) {
          result += escapeHtml(source[i + 1]);
          i += 2;
          continue;
        }
        let formatted = false;
        for (const [delimiter, open, close] of formats) {
          if (!source.startsWith(delimiter, i)) continue;
          // Underscores inside words (e.g. file_name) are not emphasis.
          if (delimiter[0] === '_' && /[A-Za-z0-9]/.test(source[i - 1] || '')) continue;
          const end = closingAt(source, delimiter, i + delimiter.length);
          if (end < 0) continue;
          const content = source.slice(i + delimiter.length, end);
          if (!content || /^\s|\s$/.test(content)) continue;
          if (delimiter[0] === '_' && /[A-Za-z0-9]/.test(source[end + delimiter.length] || '')) continue;
          result += open + inline(content) + close;
          i = end + delimiter.length;
          formatted = true;
          break;
        }
        if (!formatted) { result += escapeHtml(source[i]); i++; }
      }
      return result;
    }
    return raw.split('\n').map(inline).join('\n');
  }

  function renderInline(parts) {
    if (!parts.length) return '<br>';
    return parts.map(function (part) {
      if (typeof part.insert !== 'string') {
        const image = safeUrl(part.insert.image, true);
        return image ? '<img src="' + escapeHtml(image) + '" alt="Lesson illustration" loading="lazy">' : '';
      }
      let html = escapeHtml(part.insert);
      const attributes = part.attributes || {};
      if (attributes.bold) html = '<strong>' + html + '</strong>';
      if (attributes.italic) html = '<em>' + html + '</em>';
      if (attributes.underline) html = '<u>' + html + '</u>';
      const href = safeUrl(attributes.link, false);
      if (href) html = '<a href="' + escapeHtml(href)
        + '" target="_blank" rel="noopener noreferrer">' + html + '</a>';
      return html;
    }).join('') || '<br>';
  }

  function renderDelta(value) {
    const operations = readDelta(value).ops;
    const lines = [];
    let parts = [];
    operations.forEach(function (operation) {
      const attributes = operation.attributes || {};
      if (typeof operation.insert !== 'string') {
        parts.push({ insert:operation.insert, attributes:attributes });
        return;
      }
      const pieces = operation.insert.split('\n');
      pieces.forEach(function (piece, index) {
        if (piece) parts.push({ insert:piece, attributes:attributes });
        if (index < pieces.length - 1) {
          lines.push({ parts:parts, attributes:attributes });
          parts = [];
        }
      });
    });
    if (parts.length) lines.push({ parts:parts, attributes:{} });
    let html = '';
    let listTag = '';
    function closeList() {
      if (listTag) html += '</' + listTag + '>';
      listTag = '';
    }
    lines.forEach(function (line) {
      const attributes = line.attributes || {};
      const content = renderInline(line.parts);
      const indent = attributes.indent;
      const className = indent ? ' class="cmcIndent-' + indent + '"' : '';
      if (attributes.list) {
        const next = attributes.list === 'ordered' ? 'ol' : 'ul';
        if (next !== listTag) {
          closeList();
          listTag = next;
          html += '<' + next + '>';
        }
        html += '<li' + className + '>' + content + '</li>';
        return;
      }
      closeList();
      if (attributes.header) {
        const tag = 'h' + attributes.header;
        html += '<' + tag + className + '>' + content + '</' + tag + '>';
      } else if (attributes.blockquote) {
        html += '<blockquote' + className + '><p>' + content + '</p></blockquote>';
      } else {
        html += '<p' + className + '>' + content + '</p>';
      }
    });
    closeList();
    return html;
  }

  function render(value) {
    try {
      const body = lessonBody(value);
      return isRichText(body) ? renderDelta(body) : renderMarkdown(body);
    } catch (_) {
      return '<p>This lesson content could not be displayed. Please contact the course administrator.</p>';
    }
  }

  return {
    PREFIX:PREFIX, LESSON_PREFIX:LESSON_PREFIX, MAX_LENGTH:MAX_LENGTH,
    LESSON_FORMATS:LESSON_FORMATS, isRichText:isRichText, isLessonEnvelope:isLessonEnvelope,
    readDelta:readDelta, serializeDelta:serializeDelta, validateContent:validateContent,
    lessonBody:lessonBody, lessonFormats:lessonFormats, serializeLesson:serializeLesson,
    render:render, renderMarkdown:renderMarkdown, renderReflectionPrompt:renderReflectionPrompt, safeUrl:safeUrl
  };
});
