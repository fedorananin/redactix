import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class Table extends Module {
    constructor(instance) {
        super(instance);
        this.contextMenu = null;
        this.currentCell = null;
        this.cellHandle = null;
        this.rowHandle = null;
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

        // Click on cell handle
        this.cellHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showContextMenuAtHandle(this.cellHandle, 'cell');
        });

        // Click on row handle
        this.rowHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showContextMenuAtHandle(this.rowHandle, 'row');
        });
    }

    bindEvents() {
        // Context menu on right click on a cell
        this.instance.editorEl.addEventListener('contextmenu', (e) => {
            const cell = e.target.closest('td, th');
            if (cell && cell.closest('table')) {
                e.preventDefault();
                this.currentCell = cell;
                this.showContextMenu(e);
            }
        });

        // Show handles when hovering over a table cell
        this.instance.editorEl.addEventListener('mousemove', (e) => {
            const cell = e.target.closest('td, th');
            if (cell && cell.closest('table')) {
                this.currentCell = cell;
                this.showHandles(cell);
            } else {
                // Check if we are hovering over handles
                if (!this.cellHandle.contains(e.target) && 
                    !this.rowHandle.contains(e.target) &&
                    this.contextMenu.style.display === 'none') {
                    this.hideHandles();
                }
            }
        });

        // Hide handles when leaving the editor
        this.instance.wrapper.addEventListener('mouseleave', (e) => {
            if (!this.cellHandle.contains(e.relatedTarget) && 
                !this.rowHandle.contains(e.relatedTarget) &&
                (!this.contextMenu || this.contextMenu.style.display === 'none')) {
                this.hideHandles();
            }
        });

        // Hide menu on click (via registry - removed in destroy())
        this.instance.listen(document, 'click', (e) => {
            if (this.contextMenu &&
                !this.contextMenu.contains(e.target) &&
                !this.cellHandle.contains(e.target) &&
                !this.rowHandle.contains(e.target)) {
                this.hideContextMenu();
            }
        });
    }

    showHandles(cell) {
        const cellRect = cell.getBoundingClientRect();
        const wrapperRect = this.instance.wrapper.getBoundingClientRect();
        const row = cell.closest('tr');

        // Position cell handle (top right of the cell)
        this.cellHandle.style.display = 'flex';
        this.cellHandle.style.left = `${cellRect.right - wrapperRect.left - 20}px`;
        this.cellHandle.style.top = `${cellRect.top - wrapperRect.top + 2}px`;

        // Position row handle (left of the row)
        if (row) {
            const rowRect = row.getBoundingClientRect();
            this.rowHandle.style.display = 'flex';
            this.rowHandle.style.left = `${rowRect.left - wrapperRect.left - 22}px`;
            this.rowHandle.style.top = `${rowRect.top - wrapperRect.top + (rowRect.height / 2) - 10}px`;
        }
    }

    hideHandles() {
        this.cellHandle.style.display = 'none';
        this.rowHandle.style.display = 'none';
    }

    /** Hide handles and context menu (called when entering HTML mode). */
    hideUI() {
        this.hideHandles();
        this.hideContextMenu();
        this.currentCell = null;
    }

    showContextMenuAtHandle(handle, type) {
        const handleRect = handle.getBoundingClientRect();
        const wrapperRect = this.instance.wrapper.getBoundingClientRect();

        // Build menu
        this.buildContextMenu(type);

        this.contextMenu.style.display = 'block';
        
        // Position below handle
        let left = handleRect.left - wrapperRect.left;
        let top = handleRect.bottom - wrapperRect.top + 5;
        
        // Verify boundaries
        const menuRect = this.contextMenu.getBoundingClientRect();
        if (left + menuRect.width > wrapperRect.width) {
            left = wrapperRect.width - menuRect.width - 5;
        }
        if (left < 5) left = 5;

        this.contextMenu.style.left = `${left}px`;
        this.contextMenu.style.top = `${top}px`;
    }

    createContextMenu() {
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'redactix-table-menu';
        this.contextMenu.style.display = 'none';
        this.instance.wrapper.appendChild(this.contextMenu);
    }

    buildContextMenu(type = 'full') {
        this.contextMenu.innerHTML = '';
        
        let actions = [];
        
        if (type === 'cell') {
            // Menu for cell
            actions = [
                { label: this.t('table.insertColumnLeft'), action: () => this.insertColumn('before') },
                { label: this.t('table.insertColumnRight'), action: () => this.insertColumn('after') },
                { type: 'divider' },
                { label: this.currentCell.tagName === 'TH' ? this.t('table.makeRegular') : this.t('table.makeHeader'), action: () => this.toggleHeaderCell() },
                { type: 'divider' },
                { label: this.t('table.cellAttributes'), action: () => this.openAttributesModal(this.currentCell) },
                { type: 'divider' },
                { label: this.t('table.deleteColumn'), action: () => this.deleteColumn(), danger: true }
            ];
        } else if (type === 'row') {
            // Menu for row
            const row = this.currentCell?.closest('tr');
            actions = [
                { label: this.t('table.insertRowAbove'), action: () => this.insertRow('before') },
                { label: this.t('table.insertRowBelow'), action: () => this.insertRow('after') },
                { type: 'divider' },
                { label: this.t('table.makeRowHeader'), action: () => this.toggleHeaderRow() },
                { type: 'divider' },
                { label: this.t('table.rowAttributes'), action: () => this.openAttributesModal(row) },
                { type: 'divider' },
                { label: this.t('table.deleteRow'), action: () => this.deleteRow(), danger: true },
                { label: this.t('table.deleteTable'), action: () => this.deleteTable(), danger: true }
            ];
        } else {
            // Full menu (on right click)
            actions = [
                { label: this.t('table.insertRowAbove'), action: () => this.insertRow('before') },
                { label: this.t('table.insertRowBelow'), action: () => this.insertRow('after') },
                { type: 'divider' },
                { label: this.t('table.insertColumnLeft'), action: () => this.insertColumn('before') },
                { label: this.t('table.insertColumnRight'), action: () => this.insertColumn('after') },
                { type: 'divider' },
                { label: this.currentCell.tagName === 'TH' ? this.t('table.makeRegular') : this.t('table.makeHeader'), action: () => this.toggleHeaderCell() },
                { label: this.t('table.makeRowHeader'), action: () => this.toggleHeaderRow() },
                { type: 'divider' },
                { label: this.t('table.cellAttributes'), action: () => this.openAttributesModal(this.currentCell) },
                { label: this.t('table.rowAttributes'), action: () => this.openAttributesModal(this.currentCell?.closest('tr')) },
                { type: 'divider' },
                { label: this.t('table.deleteRow'), action: () => this.deleteRow(), danger: true },
                { label: this.t('table.deleteColumn'), action: () => this.deleteColumn(), danger: true },
                { label: this.t('table.deleteTable'), action: () => this.deleteTable(), danger: true }
            ];
        }

        actions.forEach(item => {
            if (item.type === 'divider') {
                const divider = document.createElement('div');
                divider.className = 'redactix-menu-divider';
                this.contextMenu.appendChild(divider);
                return;
            }

            const btn = document.createElement('div');
            btn.className = 'redactix-menu-item' + (item.danger ? ' redactix-menu-item-danger' : '');
            btn.textContent = item.label;
            btn.addEventListener('click', () => {
                item.action();
                this.hideContextMenu();
            });
            this.contextMenu.appendChild(btn);
        });
    }

    openAttributesModal(element) {
        if (!element) return;
        const attributesModule = this.instance.modules.find(m => m.constructor.name === 'Attributes');
        if (attributesModule) {
            attributesModule.openModal(element);
        }
    }

    showContextMenu(e) {
        const wrapperRect = this.instance.wrapper.getBoundingClientRect();
        
        // Build menu
        this.buildContextMenu('full');

        // Position taking boundaries into account
        this.contextMenu.style.display = 'block';
        
        // Get menu dimensions after showing
        const menuRect = this.contextMenu.getBoundingClientRect();
        
        let left = e.clientX - wrapperRect.left;
        let top = e.clientY - wrapperRect.top;
        
        // Check right boundary
        if (left + menuRect.width > wrapperRect.width) {
            left = wrapperRect.width - menuRect.width - 5;
        }
        
        // Check left boundary
        if (left < 5) {
            left = 5;
        }
        
        // Check bottom boundary
        if (top + menuRect.height > wrapperRect.height) {
            top = e.clientY - wrapperRect.top - menuRect.height;
        }
        
        // Check top boundary
        if (top < 5) {
            top = 5;
        }
        
        this.contextMenu.style.left = `${left}px`;
        this.contextMenu.style.top = `${top}px`;
    }

    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.style.display = 'none';
        }
    }

    openModal() {
        this.instance.selection.save();

        const form = document.createElement('div');
        
        const rowsGroup = this.createInputGroup(this.t('table.rows'), 'number', '3');
        const colsGroup = this.createInputGroup(this.t('table.columns'), 'number', '3');
        
        // Checkbox for header
        const headerDiv = document.createElement('div');
        headerDiv.style.marginTop = '10px';
        const headerLabel = document.createElement('label');
        headerLabel.style.fontWeight = 'normal';
        headerLabel.style.display = 'inline-flex';
        headerLabel.style.alignItems = 'center';
        headerLabel.style.cursor = 'pointer';
        const headerCheck = document.createElement('input');
        headerCheck.type = 'checkbox';
        headerCheck.style.width = 'auto';
        headerCheck.style.marginRight = '5px';
        headerCheck.checked = true;
        headerLabel.append(headerCheck, this.t('table.firstRowHeader'));
        headerDiv.appendChild(headerLabel);
        
        form.append(rowsGroup, colsGroup, headerDiv);

        this.instance.modal.open({
            title: this.t('table.title'),
            body: form,
            onSave: () => {
                const rows = parseInt(rowsGroup.querySelector('input').value, 10);
                const cols = parseInt(colsGroup.querySelector('input').value, 10);
                const hasHeader = headerCheck.checked;

                if (rows > 0 && cols > 0) {
                    this.instance.selection.restore();
                    this.insertTable(rows, cols, hasHeader);
                    this.instance.sync();
                }
            }
        });
    }

    createInputGroup(labelText, type, value) {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        input.min = '1';
        div.append(label, input);
        return div;
    }

    insertTable(rows, cols, hasHeader = true) {
        const table = document.createElement('table');

        // Create thead if header is needed
        if (hasHeader && rows > 0) {
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            for (let j = 0; j < cols; j++) {
                const th = document.createElement('th');
                th.textContent = `${this.t('table.headerPrefix')} ${j + 1}`;
                tr.appendChild(th);
            }
            thead.appendChild(tr);
            table.appendChild(thead);
            rows--; // Decrease number of rows for tbody
        }

        // Create tbody
        if (rows > 0) {
            const tbody = document.createElement('tbody');
            for (let i = 0; i < rows; i++) {
                const tr = document.createElement('tr');
                for (let j = 0; j < cols; j++) {
                    const td = document.createElement('td');
                    td.innerHTML = '<br>'; // Empty cell with editing possibility
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
            table.appendChild(tbody);
        }

        // Insert table and paragraph after it
        const fragment = document.createDocumentFragment();
        fragment.appendChild(table);
        
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        fragment.appendChild(p);

        this.instance.selection.insertNode(fragment);
    }

    // --- Actions with table ---

    getTable() {
        return this.currentCell?.closest('table');
    }

    getRowIndex() {
        const row = this.currentCell?.closest('tr');
        if (!row) return -1;
        const table = this.getTable();
        const allRows = table.querySelectorAll('tr');
        return Array.from(allRows).indexOf(row);
    }

    getCellIndex() {
        const row = this.currentCell?.closest('tr');
        if (!row) return -1;
        return Array.from(row.children).indexOf(this.currentCell);
    }

    insertRow(position) {
        const table = this.getTable();
        const row = this.currentCell?.closest('tr');
        if (!table || !row) return;

        const colCount = row.children.length;
        const newRow = document.createElement('tr');
        
        // Determine cell type (if row in thead - th, otherwise td)
        const isInHead = row.closest('thead') !== null;
        const cellTag = isInHead ? 'th' : 'td';
        
        for (let i = 0; i < colCount; i++) {
            const cell = document.createElement(cellTag);
            cell.innerHTML = '<br>';
            newRow.appendChild(cell);
        }

        if (position === 'before') {
            row.parentNode.insertBefore(newRow, row);
        } else {
            row.parentNode.insertBefore(newRow, row.nextSibling);
        }

        this.instance.sync();
    }

    insertColumn(position) {
        const table = this.getTable();
        if (!table) return;

        const cellIndex = this.getCellIndex();
        if (cellIndex === -1) return;

        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.children;
            const isHeader = row.closest('thead') !== null;
            const newCell = document.createElement(isHeader ? 'th' : 'td');
            newCell.innerHTML = isHeader ? this.t('table.headerPrefix') : '<br>';

            if (position === 'before') {
                row.insertBefore(newCell, cells[cellIndex]);
            } else {
                row.insertBefore(newCell, cells[cellIndex + 1] || null);
            }
        });

        this.instance.sync();
    }

    deleteRow() {
        const row = this.currentCell?.closest('tr');
        if (!row) return;

        const table = this.getTable();
        const tbody = row.closest('tbody');
        const thead = row.closest('thead');
        
        // If this is the last row - delete the whole table
        const allRows = table.querySelectorAll('tr');
        if (allRows.length <= 1) {
            this.deleteTable();
            return;
        }

        row.remove();

        // If tbody is empty - delete it
        if (tbody && tbody.children.length === 0) {
            tbody.remove();
        }
        // If thead is empty - delete it
        if (thead && thead.children.length === 0) {
            thead.remove();
        }

        this.instance.sync();
    }

    deleteColumn() {
        const table = this.getTable();
        if (!table) return;

        const cellIndex = this.getCellIndex();
        if (cellIndex === -1) return;

        const rows = table.querySelectorAll('tr');
        
        // Check that this is not the last column
        if (rows[0].children.length <= 1) {
            this.deleteTable();
            return;
        }

        rows.forEach(row => {
            const cell = row.children[cellIndex];
            if (cell) cell.remove();
        });

        this.instance.sync();
    }

    deleteTable() {
        const table = this.getTable();
        if (table) {
            table.remove();
            this.instance.sync();
        }
    }

    toggleHeaderCell() {
        if (!this.currentCell) return;

        const row = this.currentCell.closest('tr');
        const cellIndex = this.getCellIndex();
        const newTag = this.currentCell.tagName === 'TH' ? 'td' : 'th';
        
        const newCell = document.createElement(newTag);
        newCell.innerHTML = this.currentCell.innerHTML;
        
        // Copy attributes
        Array.from(this.currentCell.attributes).forEach(attr => {
            newCell.setAttribute(attr.name, attr.value);
        });

        row.replaceChild(newCell, this.currentCell);
        this.currentCell = newCell;

        this.instance.sync();
    }

    toggleHeaderRow() {
        const row = this.currentCell?.closest('tr');
        if (!row) return;

        const table = this.getTable();
        const isInHead = row.closest('thead') !== null;

        if (isInHead) {
            // Move from thead to tbody
            let tbody = table.querySelector('tbody');
            if (!tbody) {
                tbody = document.createElement('tbody');
                table.appendChild(tbody);
            }
            
            // Convert th to td
            const newRow = document.createElement('tr');
            Array.from(row.children).forEach(cell => {
                const td = document.createElement('td');
                td.innerHTML = cell.innerHTML;
                newRow.appendChild(td);
            });
            
            tbody.insertBefore(newRow, tbody.firstChild);
            row.remove();
            
            // Delete empty thead
            const thead = table.querySelector('thead');
            if (thead && thead.children.length === 0) {
                thead.remove();
            }
        } else {
            // Move to thead
            let thead = table.querySelector('thead');
            if (!thead) {
                thead = document.createElement('thead');
                table.insertBefore(thead, table.firstChild);
            }
            
            // Convert td to th
            const newRow = document.createElement('tr');
            Array.from(row.children).forEach(cell => {
                const th = document.createElement('th');
                th.innerHTML = cell.innerHTML;
                newRow.appendChild(th);
            });
            
            thead.appendChild(newRow);
            row.remove();
        }

        this.instance.sync();
    }
}
