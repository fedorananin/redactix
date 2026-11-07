import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { inputGroup, checkbox } from '../ui/form-helpers.js';
import { placePopover } from '../ui/popover.js';
import { pushEscapeLayer } from '../core/layers.js';

const MAX_ROWS = 200;
const MAX_COLS = 50;

/**
 * Visual grid of a table: grid[r][c] is the cell covering row r / column c,
 * accounting for rowspan / colspan (the DOM index of a cell is NOT its
 * visual column as soon as a span is involved). Rows are table.rows — the
 * table's own rows only, never those of a nested table.
 */
export function buildGrid(table) {
    const rows = Array.from(table.rows);
    const grid = rows.map(() => []);
    const pos = new Map(); // cell → { row, col, rowSpan, colSpan }
    rows.forEach((tr, r) => {
        let c = 0;
        Array.from(tr.cells).forEach(cell => {
            while (grid[r][c]) c++;
            const rowSpan = Math.max(1, Math.min(parseInt(cell.getAttribute('rowspan'), 10) || 1, rows.length - r));
            const colSpan = Math.max(1, parseInt(cell.getAttribute('colspan'), 10) || 1);
            pos.set(cell, { row: r, col: c, rowSpan, colSpan });
            for (let dr = 0; dr < rowSpan; dr++) {
                for (let dc = 0; dc < colSpan; dc++) {
                    grid[r + dr][c + dc] = cell;
                }
            }
            c += colSpan;
        });
    });
    const width = grid.reduce((w, row) => Math.max(w, row.length), 0);
    return { rows, grid, pos, width };
}

function setSpan(cell, name, value) {
    if (value > 1) cell.setAttribute(name, String(value));
    else cell.removeAttribute(name);
}

/** Insert `cell` into `tr` so that it sits at visual column `col`. */
function insertCellAt(tr, cell, col, gridInfo) {
    const ref = Array.from(tr.cells).find(c => {
        const p = gridInfo.pos.get(c);
        return p && p.col >= col;
    });
    tr.insertBefore(cell, ref || null);
}

/** Replace a cell by one with another tag, keeping attributes and children. */
function retagCell(cell, tag) {
    if (cell.tagName === tag.toUpperCase()) return cell;
    const next = document.createElement(tag);
    Array.from(cell.attributes).forEach(a => next.setAttribute(a.name, a.value));
    while (cell.firstChild) next.appendChild(cell.firstChild);
    cell.parentNode.replaceChild(next, cell);
    return next;
}

export default class Table extends Module {
    static moduleName = 'Table';

    constructor(instance) {
        super(instance);
        this.contextMenu = null;
        this.currentCell = null;
        this.cellHandle = null;
        this.rowHandle = null;
        this._hoverFrame = null;
        this._hoverEvent = null;
        this._popEscape = null;
    }

    init() {
        this.createContextMenu();
        this.createHandles();
        this.bindEvents();
    }

    getButtons() {
        return [
            {
                name: 'table',
                label: 'Table',
                icon: Icons.table,
                title: this.t('toolbar.insertTable'),
                action: () => this.openModal()
            }
        ];
    }

    createHandles() {
        // Handle for cell (td/th)
        this.cellHandle = document.createElement('div');
        this.cellHandle.className = 'redactix-table-handle redactix-table-cell-handle';
        this.cellHandle.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>`;
        this.cellHandle.style.display = 'none';
        this.cellHandle.title = this.t('blockControl.cellSettings');
        this.instance.wrapper.appendChild(this.cellHandle);

        // Handle for row (tr)
        this.rowHandle = document.createElement('div');
        this.rowHandle.className = 'redactix-table-handle redactix-table-row-handle';
        this.rowHandle.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <rect x="3" y="4" width="18" height="3" rx="1"/>
            <rect x="3" y="10" width="18" height="3" rx="1"/>
            <rect x="3" y="16" width="18" height="3" rx="1"/>
        </svg>`;
        this.rowHandle.style.display = 'none';
        this.rowHandle.title = this.t('blockControl.rowSettings');
        this.instance.wrapper.appendChild(this.rowHandle);

        this.cellHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showContextMenuAtHandle(this.cellHandle, 'cell');
        });
        this.rowHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showContextMenuAtHandle(this.rowHandle, 'row');
        });
    }

    /** Cell of one of this editor's tables under `target`, or null. */
    cellFrom(target) {
        const cell = target && target.closest ? target.closest('td, th') : null;
        return cell && cell.closest('table') && this.instance.editorEl.contains(cell) ? cell : null;
    }

    bindEvents() {
        const editor = this.instance.editorEl;

        // Context menu on right click on a cell
        editor.addEventListener('contextmenu', (e) => {
            const cell = this.cellFrom(e.target);
            if (cell) {
                e.preventDefault();
                this.currentCell = cell;
                this.showContextMenu(e);
            }
        });

        // Hover → handles, coalesced to one update per frame.
        editor.addEventListener('mousemove', (e) => {
            this._hoverEvent = e.target;
            if (this._hoverFrame != null) return;
            this._hoverFrame = requestAnimationFrame(() => {
                this._hoverFrame = null;
                const target = this._hoverEvent;
                this._hoverEvent = null;
                if (!this.instance.destroyed) this.onHover(target);
            });
        });

        // Hide handles when leaving the editor
        this.instance.wrapper.addEventListener('mouseleave', (e) => {
            if (!this.cellHandle.contains(e.relatedTarget) &&
                !this.rowHandle.contains(e.relatedTarget) &&
                !this.isMenuOpen()) {
                this.hideHandles();
            }
        });

        // Hide menu on click outside (via registry - removed in destroy())
        this.instance.listen(document, 'click', (e) => {
            if (this.isMenuOpen() &&
                !this.contextMenu.contains(e.target) &&
                !this.cellHandle.contains(e.target) &&
                !this.rowHandle.contains(e.target)) {
                this.hideContextMenu();
            }
        });

        // Handles and the (position:fixed) menu are placed for a given
        // scroll position — hide them whenever anything scrolls (the editor
        // itself with maxHeight, the page, any scrolling ancestor).
        this.instance.listen(window, 'scroll', () => {
            if (this.isMenuOpen()) this.hideContextMenu();
            this.hideHandles();
        }, { capture: true, passive: true });

        this.instance.onDestroy(() => {
            if (this._hoverFrame != null) cancelAnimationFrame(this._hoverFrame);
            if (this._popEscape) this._popEscape();
        });
    }

    onHover(target) {
        if (this.instance.isDraggingBlock || this.isMenuOpen()) return;
        const cell = this.cellFrom(target);
        if (cell) {
            this.currentCell = cell;
            this.showHandles(cell);
        } else if (!this.cellHandle.contains(target) && !this.rowHandle.contains(target)) {
            this.hideHandles();
        }
    }

    showHandles(cell) {
        // Read everything first, then write.
        const cellRect = cell.getBoundingClientRect();
        const wrapperRect = this.instance.wrapper.getBoundingClientRect();
        const editorRect = this.instance.editorEl.getBoundingClientRect();
        const row = cell.parentElement;
        const rowRect = row ? row.getBoundingClientRect() : null;
        const visible = cellRect.bottom > editorRect.top && cellRect.top < editorRect.bottom;
        if (!visible) {
            this.hideHandles();
            return;
        }

        // Cell handle: top right of the cell
        this.cellHandle.style.display = 'flex';
        this.cellHandle.style.left = `${cellRect.right - wrapperRect.left - 20}px`;
        this.cellHandle.style.top = `${cellRect.top - wrapperRect.top + 2}px`;

        // Row handle: left of the row
        if (rowRect) {
            this.rowHandle.style.display = 'flex';
            this.rowHandle.style.left = `${Math.max(2, rowRect.left - wrapperRect.left - 22)}px`;
            this.rowHandle.style.top = `${rowRect.top - wrapperRect.top + (rowRect.height / 2) - 10}px`;
        }
    }

    hideHandles() {
        this.cellHandle.style.display = 'none';
        this.rowHandle.style.display = 'none';
    }

    /** Hide handles and context menu (HTML mode, content replaced). */
    hideUI() {
        this.hideHandles();
        this.hideContextMenu();
        this.currentCell = null;
    }

    // ------------------------------------------------------------------
    // Context menu
    // ------------------------------------------------------------------

    createContextMenu() {
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'redactix-table-menu';
        this.contextMenu.setAttribute('role', 'menu');
        this.contextMenu.style.display = 'none';
        this.instance.wrapper.appendChild(this.contextMenu);
    }

    isMenuOpen() {
        return !!this.contextMenu && this.contextMenu.style.display === 'block';
    }

    showContextMenuAtHandle(handle, type) {
        if (!this.liveCell()) return;
        this.openMenu(type, handle.getBoundingClientRect());
    }

    showContextMenu(e) {
        const point = { left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY, width: 0, height: 0 };
        this.openMenu('full', point);
    }

    openMenu(type, anchorRect) {
        this.buildContextMenu(type);
        // position:fixed (see CSS) — never clipped by the wrapper's
        // overflow, flips above when there's no room below.
        this.contextMenu.style.display = 'block';
        placePopover(this.contextMenu, anchorRect, { side: 'bottom', align: 'start', offset: 5 });
        if (!this._popEscape) {
            this._popEscape = pushEscapeLayer(() => this.hideContextMenu(), { scope: [this.instance.wrapper] });
        }
    }

    hideContextMenu() {
        if (this.contextMenu) this.contextMenu.style.display = 'none';
        if (this._popEscape) {
            this._popEscape();
            this._popEscape = null;
        }
    }

    /** Is the row a header row (in <thead>, or made of <th> only)? */
    isHeaderRow(row) {
        if (!row) return false;
        if (row.parentElement && row.parentElement.tagName === 'THEAD') return true;
        const cells = Array.from(row.cells);
        return cells.length > 0 && cells.every(c => c.tagName === 'TH');
    }

    buildContextMenu(type = 'full') {
        this.contextMenu.innerHTML = '';
        const cell = this.currentCell;
        if (!cell) return;
        const row = cell.parentElement;
        const lite = !!this.instance.config.liteMode;

        const cellHeader = { label: cell.tagName === 'TH' ? this.t('table.makeRegular') : this.t('table.makeHeader'), action: () => this.toggleHeaderCell() };
        const rowHeader = { label: this.isHeaderRow(row) ? this.t('table.makeRowRegular') : this.t('table.makeRowHeader'), action: () => this.toggleHeaderRow() };
        const cellAttrs = lite ? null : { label: this.t('table.cellAttributes'), action: () => this.openAttributesModal(this.currentCell) };
        const rowAttrs = lite ? null : { label: this.t('table.rowAttributes'), action: () => this.openAttributesModal(this.currentCell && this.currentCell.parentElement) };
        const divider = { type: 'divider' };

        let actions;
        if (type === 'cell') {
            actions = [
                { label: this.t('table.insertColumnLeft'), action: () => this.insertColumn('before') },
                { label: this.t('table.insertColumnRight'), action: () => this.insertColumn('after') },
                divider,
                cellHeader,
                cellAttrs && divider,
                cellAttrs,
                divider,
                { label: this.t('table.deleteColumn'), action: () => this.deleteColumn(), danger: true }
            ];
        } else if (type === 'row') {
            actions = [
                { label: this.t('table.insertRowAbove'), action: () => this.insertRow('before') },
                { label: this.t('table.insertRowBelow'), action: () => this.insertRow('after') },
                divider,
                rowHeader,
                rowAttrs && divider,
                rowAttrs,
                divider,
                { label: this.t('table.deleteRow'), action: () => this.deleteRow(), danger: true },
                { label: this.t('table.deleteTable'), action: () => this.deleteTable(), danger: true }
            ];
        } else {
            actions = [
                { label: this.t('table.insertRowAbove'), action: () => this.insertRow('before') },
                { label: this.t('table.insertRowBelow'), action: () => this.insertRow('after') },
                divider,
                { label: this.t('table.insertColumnLeft'), action: () => this.insertColumn('before') },
                { label: this.t('table.insertColumnRight'), action: () => this.insertColumn('after') },
                divider,
                cellHeader,
                rowHeader,
                cellAttrs && divider,
                cellAttrs,
                rowAttrs,
                divider,
                { label: this.t('table.deleteRow'), action: () => this.deleteRow(), danger: true },
                { label: this.t('table.deleteColumn'), action: () => this.deleteColumn(), danger: true },
                { label: this.t('table.deleteTable'), action: () => this.deleteTable(), danger: true }
            ];
        }

        actions.filter(Boolean).forEach(item => {
            if (item.type === 'divider') {
                const div = document.createElement('div');
                div.className = 'redactix-menu-divider';
                this.contextMenu.appendChild(div);
                return;
            }
            const btn = document.createElement('div');
            btn.className = 'redactix-menu-item' + (item.danger ? ' redactix-menu-item-danger' : '');
            btn.setAttribute('role', 'menuitem');
            btn.textContent = item.label;
            btn.addEventListener('click', () => {
                this.hideContextMenu();
                item.action();
            });
            this.contextMenu.appendChild(btn);
        });
    }

    openAttributesModal(element) {
        if (!element || this.instance.config.liteMode) return;
        const attributesModule = this.getModule('Attributes');
        if (attributesModule) attributesModule.openModal(element);
    }

    // ------------------------------------------------------------------
    // Insert
    // ------------------------------------------------------------------

    openModal() {
        this.instance.selection.save();

        const form = document.createElement('div');
        const rowsGroup = inputGroup(this.t('table.rows'), 'number', '3');
        const colsGroup = inputGroup(this.t('table.columns'), 'number', '3');
        [rowsGroup, colsGroup].forEach(g => {
            g.field.min = '1';
        });
        rowsGroup.field.max = String(MAX_ROWS);
        colsGroup.field.max = String(MAX_COLS);
        const header = checkbox(this.t('table.firstRowHeader'), true);
        form.append(rowsGroup, colsGroup, header);

        this.instance.modal.open({
            title: this.t('table.title'),
            body: form,
            onSave: () => {
                const rows = parseInt(rowsGroup.field.value, 10);
                const cols = parseInt(colsGroup.field.value, 10);
                if (!(rows > 0 && cols > 0)) return false;
                this.instance.selection.restore();
                this.insertTable(Math.min(rows, MAX_ROWS), Math.min(cols, MAX_COLS), header.field.checked);
            }
        });
    }

    /**
     * Insert a rows × cols table at the caret (one undo step). Selection.
     * insertNode applies the container rules (a table can't go into a
     * callout / quote-card / list → it lands after it) and adds an empty
     * paragraph after the table only when nothing editable follows.
     * The caret ends up in the first body cell.
     * @returns {HTMLTableElement}
     */
    insertTable(rows, cols, hasHeader = true) {
        rows = Math.max(1, parseInt(rows, 10) || 1);
        cols = Math.max(1, parseInt(cols, 10) || 1);
        const table = document.createElement('table');

        if (hasHeader) {
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            for (let j = 0; j < cols; j++) {
                const th = document.createElement('th');
                th.textContent = `${this.t('table.headerPrefix')} ${j + 1}`;
                tr.appendChild(th);
            }
            thead.appendChild(tr);
            table.appendChild(thead);
            rows--;
        }

        if (rows > 0) {
            const tbody = document.createElement('tbody');
            for (let i = 0; i < rows; i++) {
                const tr = document.createElement('tr');
                for (let j = 0; j < cols; j++) {
                    const td = document.createElement('td');
                    td.innerHTML = '<br>';
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
            table.appendChild(tbody);
        }

        this.transact(() => {
            this.instance.selection.insertNode(table);
            if (!table.parentNode) this.instance.editorEl.appendChild(table);
        });

        const first = table.querySelector('td') || table.querySelector('th');
        if (first) {
            const range = document.createRange();
            range.selectNodeContents(first);
            // Empty body cell (<br>) → start; header cell with text → end.
            range.collapse(first.tagName === 'TD');
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
        return table;
    }

    // ------------------------------------------------------------------
    // Table operations (all span-aware, each one undo step)
    // ------------------------------------------------------------------

    /** currentCell if it still lives in this editor, else null (and UI hidden). */
    liveCell() {
        const cell = this.currentCell;
        if (cell && cell.closest('table') && this.instance.editorEl.contains(cell)) return cell;
        this.hideUI();
        return null;
    }

    getTable() {
        const cell = this.liveCell();
        return cell ? cell.closest('table') : null;
    }

    /** Run a table operation as one undo step, then refresh the handles. */
    tableOp(fn) {
        const cell = this.liveCell();
        if (!cell) return;
        const table = cell.closest('table');
        this.transact(() => fn(table, cell));
        if (this.currentCell && this.instance.editorEl.contains(this.currentCell)) {
            this.showHandles(this.currentCell);
        } else {
            this.hideUI();
        }
    }

    insertRow(position) {
        this.tableOp((table, cell) => {
            const info = buildGrid(table);
            const p = info.pos.get(cell);
            const row = cell.parentElement;
            const section = row.parentElement;

            // Boundary row index: the new row goes right before it.
            let boundary = position === 'before' ? p.row : p.row + p.rowSpan;
            let targetSection = section;
            let refRow = info.rows[boundary] || null;
            let tag = section.tagName === 'THEAD' ? 'th' : 'td';

            // "Below" the last header row starts the body, it doesn't add
            // another header row.
            if (position === 'after' && section.tagName === 'THEAD' &&
                (!refRow || refRow.parentElement !== section)) {
                let tbody = table.tBodies[0];
                if (!tbody) {
                    tbody = document.createElement('tbody');
                    section.parentNode.insertBefore(tbody, section.nextSibling);
                }
                targetSection = tbody;
                refRow = tbody.rows[0] || null;
                boundary = refRow ? info.rows.indexOf(refRow) : info.rows.length;
                tag = 'td';
            }
            if (refRow && refRow.parentElement !== targetSection) refRow = null;

            // Cells spanning across the boundary (same section) grow instead
            // of getting a new cell under them.
            const newRow = document.createElement('tr');
            const crossing = new Set();
            if (boundary > 0 && boundary < info.rows.length) {
                (info.grid[boundary] || []).forEach(c => {
                    const cp = info.pos.get(c);
                    if (cp.row < boundary && c.parentElement.parentElement === targetSection) crossing.add(c);
                });
            }
            for (let col = 0; col < info.width; col++) {
                const over = info.grid[boundary] ? info.grid[boundary][col] : null;
                if (over && crossing.has(over)) continue;
                const c = document.createElement(tag);
                c.innerHTML = '<br>';
                newRow.appendChild(c);
            }
            crossing.forEach(c => setSpan(c, 'rowspan', info.pos.get(c).rowSpan + 1));
            targetSection.insertBefore(newRow, refRow);
        });
    }

    insertColumn(position) {
        this.tableOp((table, cell) => {
            const info = buildGrid(table);
            const p = info.pos.get(cell);
            const boundary = position === 'before' ? p.col : p.col + p.colSpan;
            const grown = new Set();
            info.rows.forEach((tr, r) => {
                const left = boundary > 0 ? info.grid[r][boundary - 1] : null;
                const right = info.grid[r][boundary];
                // A cell spanning across the boundary just gets wider.
                if (left && left === right) {
                    if (!grown.has(left)) {
                        grown.add(left);
                        setSpan(left, 'colspan', info.pos.get(left).colSpan + 1);
                    }
                    return;
                }
                const isHead = tr.parentElement && tr.parentElement.tagName === 'THEAD';
                const c = document.createElement(isHead ? 'th' : 'td');
                if (isHead) c.textContent = this.t('table.headerPrefix');
                else c.innerHTML = '<br>';
                insertCellAt(tr, c, boundary, info);
            });
        });
    }

    deleteRow() {
        const cell = this.liveCell();
        if (!cell) return;
        const table = cell.closest('table');
        if (table.rows.length <= 1) {
            this.deleteTable();
            return;
        }
        this.tableOp((table, cell) => {
            const info = buildGrid(table);
            const row = cell.parentElement;
            const r = info.rows.indexOf(row);
            const next = info.rows[r + 1];
            const seen = new Set();
            (info.grid[r] || []).forEach(c => {
                if (!c || seen.has(c)) return;
                seen.add(c);
                const cp = info.pos.get(c);
                if (cp.rowSpan <= 1) return;
                if (cp.row < r) {
                    // Spans in from above: one row shorter.
                    setSpan(c, 'rowspan', cp.rowSpan - 1);
                } else if (next) {
                    // Starts here and spans down: move it to the next row.
                    setSpan(c, 'rowspan', cp.rowSpan - 1);
                    insertCellAt(next, c, cp.col, info);
                }
            });
            const section = row.parentElement;
            row.remove();
            if (section && section !== table && section.rows.length === 0) section.remove();
            this.currentCell = null;
        });
        this.hideUI();
    }

    deleteColumn() {
        const cell = this.liveCell();
        if (!cell) return;
        const table = cell.closest('table');
        if (buildGrid(table).width <= 1) {
            this.deleteTable();
            return;
        }
        this.tableOp((table, cell) => {
            const info = buildGrid(table);
            const col = info.pos.get(cell).col;
            const seen = new Set();
            info.rows.forEach((tr, r) => {
                const c = info.grid[r][col];
                if (!c || seen.has(c)) return;
                seen.add(c);
                const cp = info.pos.get(c);
                if (cp.colSpan > 1) setSpan(c, 'colspan', cp.colSpan - 1);
                else c.remove();
            });
            this.currentCell = null;
        });
        this.hideUI();
    }

    deleteTable() {
        const table = this.getTable();
        if (!table) return;
        this.transact(() => {
            table.remove();
            // Keep somewhere to type.
            if (!this.instance.editorEl.firstElementChild) {
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                this.instance.editorEl.appendChild(p);
            }
        });
        this.hideUI();
    }

    toggleHeaderCell() {
        this.tableOp((table, cell) => {
            this.currentCell = retagCell(cell, cell.tagName === 'TH' ? 'td' : 'th');
        });
    }

    /**
     * Header row toggle. Positions never jump:
     *  - make header: cells become <th> (attributes, spans, content kept);
     *    if the row is the first body row right under the header section
     *    (or the very first row of a table without one), it also moves
     *    into <thead>.
     *  - make regular: cells become <td>; a row in <thead> moves to the
     *    top of <tbody> together with any header rows below it, so the
     *    visual order is unchanged.
     */
    toggleHeaderRow() {
        this.tableOp((table, cell) => {
            const row = cell.parentElement;
            const section = row.parentElement;
            const index = Array.from(row.cells).indexOf(cell);

            if (this.isHeaderRow(row)) {
                Array.from(row.cells).forEach(c => retagCell(c, 'td'));
                if (section.tagName === 'THEAD') {
                    let tbody = table.tBodies[0];
                    if (!tbody) {
                        tbody = document.createElement('tbody');
                        section.parentNode.insertBefore(tbody, section.nextSibling);
                    }
                    const moving = Array.from(section.rows).slice(Array.from(section.rows).indexOf(row));
                    const ref = tbody.rows[0] || null;
                    moving.forEach(tr => tbody.insertBefore(tr, ref));
                    if (section.rows.length === 0) section.remove();
                }
            } else {
                Array.from(row.cells).forEach(c => retagCell(c, 'th'));
                const thead = table.tHead;
                const firstBodyRow = section.tagName === 'TBODY' && section.rows[0] === row &&
                    section === table.tBodies[0];
                const directlyBelowHead = thead ? section.previousElementSibling === thead : table.rows[0] === row;
                if (firstBodyRow && directlyBelowHead) {
                    let head = thead;
                    if (!head) {
                        head = document.createElement('thead');
                        table.insertBefore(head, section);
                    }
                    head.appendChild(row);
                    if (section.rows.length === 0) section.remove();
                }
            }
            this.currentCell = row.cells[index] || row.cells[0] || null;
        });
    }
}
