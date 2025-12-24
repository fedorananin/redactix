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
        // Ручка для ячейки (td/th)
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

        // Ручка для строки (tr)
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

        // Клик по ручке ячейки
        this.cellHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showContextMenuAtHandle(this.cellHandle, 'cell');
        });

        // Клик по ручке строки
        this.rowHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showContextMenuAtHandle(this.rowHandle, 'row');
        });
    }

    bindEvents() {
        // Контекстное меню по правому клику на ячейке
        this.instance.editorEl.addEventListener('contextmenu', (e) => {
            const cell = e.target.closest('td, th');
            if (cell && cell.closest('table')) {
                e.preventDefault();
                this.currentCell = cell;
                this.showContextMenu(e);
            }
        });

        // Показываем ручки при наведении на ячейку таблицы
        this.instance.editorEl.addEventListener('mousemove', (e) => {
            const cell = e.target.closest('td, th');
            if (cell && cell.closest('table')) {
                this.currentCell = cell;
                this.showHandles(cell);
            } else {
                // Проверяем, не на ручках ли мы
                if (!this.cellHandle.contains(e.target) && 
                    !this.rowHandle.contains(e.target) &&
                    this.contextMenu.style.display === 'none') {
                    this.hideHandles();
                }
            }
        });

        // Скрываем ручки при уходе из редактора
        this.instance.wrapper.addEventListener('mouseleave', (e) => {
            if (!this.cellHandle.contains(e.relatedTarget) && 
                !this.rowHandle.contains(e.relatedTarget) &&
                (!this.contextMenu || this.contextMenu.style.display === 'none')) {
                this.hideHandles();
            }
        });

        // Скрываем меню при клике
        document.addEventListener('click', (e) => {
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

        // Позиционируем ручку ячейки (справа сверху от ячейки)
        this.cellHandle.style.display = 'flex';
        this.cellHandle.style.left = `${cellRect.right - wrapperRect.left - 20}px`;
        this.cellHandle.style.top = `${cellRect.top - wrapperRect.top + 2}px`;

        // Позиционируем ручку строки (слева от строки)
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

    showContextMenuAtHandle(handle, type) {
        const handleRect = handle.getBoundingClientRect();
        const wrapperRect = this.instance.wrapper.getBoundingClientRect();

        // Строим меню
        this.buildContextMenu(type);

        this.contextMenu.style.display = 'block';
        
        // Позиционируем под ручкой
        let left = handleRect.left - wrapperRect.left;
        let top = handleRect.bottom - wrapperRect.top + 5;
        
        // Проверяем границы
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
            // Меню для ячейки
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
        
        // Строим меню
        this.buildContextMenu('full');

        // Позиционируем с учётом границ
        this.contextMenu.style.display = 'block';
        
        // Получаем размеры меню после отображения
        const menuRect = this.contextMenu.getBoundingClientRect();
        
        let left = e.clientX - wrapperRect.left;
        let top = e.clientY - wrapperRect.top;
        
        // Проверяем правую границу
        if (left + menuRect.width > wrapperRect.width) {
            left = wrapperRect.width - menuRect.width - 5;
        }
        
        // Проверяем левую границу
        if (left < 5) {
            left = 5;
        }
        
        // Проверяем нижнюю границу
        if (top + menuRect.height > wrapperRect.height) {
            top = e.clientY - wrapperRect.top - menuRect.height;
        }
        
        // Проверяем верхнюю границу
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
        
        // Чекбокс для заголовка
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

        // Создаём thead если нужен заголовок
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
            rows--; // Уменьшаем количество строк для tbody
        }

        // Создаём tbody
        if (rows > 0) {
            const tbody = document.createElement('tbody');
            for (let i = 0; i < rows; i++) {
                const tr = document.createElement('tr');
                for (let j = 0; j < cols; j++) {
                    const td = document.createElement('td');
                    td.innerHTML = '<br>'; // Пустая ячейка с возможностью редактирования
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
            table.appendChild(tbody);
        }

        // Вставляем таблицу и параграф после неё
        const fragment = document.createDocumentFragment();
        fragment.appendChild(table);
        
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        fragment.appendChild(p);

        this.instance.selection.insertNode(fragment);
    }

    // --- Действия с таблицей ---

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
        
        // Определяем тип ячеек (если строка в thead - th, иначе td)
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
        
        // Если это последняя строка - удаляем всю таблицу
        const allRows = table.querySelectorAll('tr');
        if (allRows.length <= 1) {
            this.deleteTable();
            return;
        }

        row.remove();

        // Если tbody пуст - удаляем его
        if (tbody && tbody.children.length === 0) {
            tbody.remove();
        }
        // Если thead пуст - удаляем его
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
        
        // Проверяем что это не последний столбец
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
        
        // Копируем атрибуты
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
            // Перемещаем из thead в tbody
            let tbody = table.querySelector('tbody');
            if (!tbody) {
                tbody = document.createElement('tbody');
                table.appendChild(tbody);
            }
            
            // Конвертируем th в td
            const newRow = document.createElement('tr');
            Array.from(row.children).forEach(cell => {
                const td = document.createElement('td');
                td.innerHTML = cell.innerHTML;
                newRow.appendChild(td);
            });
            
            tbody.insertBefore(newRow, tbody.firstChild);
            row.remove();
            
            // Удаляем пустой thead
            const thead = table.querySelector('thead');
            if (thead && thead.children.length === 0) {
                thead.remove();
            }
        } else {
            // Перемещаем в thead
            let thead = table.querySelector('thead');
            if (!thead) {
                thead = document.createElement('thead');
                table.insertBefore(thead, table.firstChild);
            }
            
            // Конвертируем td в th
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
