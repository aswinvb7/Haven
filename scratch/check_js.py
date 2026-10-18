with open('music/static/music/js/script.js', 'r', encoding='utf-8') as f:
    content = f.read()

stack = []
pairs = {')': '(', '}': '{', ']': '['}
in_str = None
escape = False
in_line_comment = False
in_block_comment = False
i = 0
line_no = 1
col_no = 0
errors = []

while i < len(content):
    c = content[i]
    col_no += 1
    if c == '\n':
        line_no += 1
        col_no = 0
        in_line_comment = False
    elif in_line_comment:
        pass
    elif in_block_comment:
        if c == '*' and i + 1 < len(content) and content[i+1] == '/':
            in_block_comment = False
            i += 1
            col_no += 1
    elif in_str:
        if escape:
            escape = False
        elif c == '\\':
            escape = True
        elif c == in_str:
            in_str = None
    else:
        if c == '/' and i + 1 < len(content) and content[i+1] == '/':
            in_line_comment = True
            i += 1
            col_no += 1
        elif c == '/' and i + 1 < len(content) and content[i+1] == '*':
            in_block_comment = True
            i += 1
            col_no += 1
        elif c in ('"', "'", '`'):
            in_str = c
        elif c in ('(', '{', '['):
            stack.append((c, line_no, col_no))
        elif c in (')', '}', ']'):
            if not stack:
                errors.append(f'Unmatched closing {c} at {line_no}:{col_no}')
            else:
                top, l, col = stack.pop()
                if top != pairs[c]:
                    errors.append(f'Mismatched {top} from {l}:{col} with {c} at {line_no}:{col_no}')
    i += 1

if stack:
    for top, l, col in stack[-5:]:
        errors.append(f'Unclosed {top} from {l}:{col}')

if errors:
    print('ERRORS:', errors)
else:
    print('JS SYNTAX CLEAN: All braces, brackets, and quotes balanced.')
