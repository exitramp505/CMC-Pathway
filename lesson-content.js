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

  function validateContent(value) {
    const content = String(value == null ? '' : value).trim();
    if (!isRichText(content)) return content.slice(0, MAX_LENGTH);
    if (content.length > MAX_LENGTH) {
      throw new Error('Written content exceeds the 50,000-character limit.');
    }
    return serializeDelta(readDelta(content).ops);
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
    if (!isRichText(value)) return renderMarkdown(value);
    try { return renderDelta(value); }
    catch (_) { return '<p>This lesson content could not be displayed. Please contact the course administrator.</p>'; }
  }

  return {
    PREFIX:PREFIX, MAX_LENGTH:MAX_LENGTH, isRichText:isRichText,
    readDelta:readDelta, serializeDelta:serializeDelta, validateContent:validateContent,
    render:render, renderMarkdown:renderMarkdown, safeUrl:safeUrl
  };
});
