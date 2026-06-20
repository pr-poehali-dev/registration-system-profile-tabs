import json
import os
import hashlib
import secrets
import psycopg2
from psycopg2.extras import RealDictCursor


def hash_password(password: str) -> str:
    salt = 'poehali_passes_salt'
    return hashlib.sha256((salt + password).encode()).hexdigest()


def make_token(user_id: int) -> str:
    raw = f"{user_id}:{secrets.token_hex(16)}"
    sig = hashlib.sha256((raw + 'token_secret').encode()).hexdigest()
    return f"{user_id}.{sig[:32]}"


def parse_user_id(token: str):
    if not token or '.' not in token:
        return None
    try:
        return int(token.split('.')[0])
    except ValueError:
        return None


def handler(event: dict, context) -> dict:
    '''Регистрация, вход и проверка пользователя по токену'''
    method = event.get('httpMethod', 'GET')
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
        'Content-Type': 'application/json'
    }
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True

    try:
        if method == 'POST':
            body = json.loads(event.get('body') or '{}')
            action = body.get('action')

            if action == 'register':
                username = (body.get('username') or '').strip().lower()
                full_name = (body.get('full_name') or '').strip()
                password = body.get('password') or ''
                department = (body.get('department') or '').strip()
                phone = (body.get('phone') or '').strip()

                if not username or not full_name or not password:
                    return {'statusCode': 400, 'headers': cors,
                            'body': json.dumps({'error': 'Заполните все обязательные поля'})}

                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("SELECT id FROM users WHERE username = %s", (username,))
                    if cur.fetchone():
                        return {'statusCode': 409, 'headers': cors,
                                'body': json.dumps({'error': 'Это имя пользователя уже занято'})}
                    cur.execute(
                        "INSERT INTO users (username, email, full_name, password_hash, department, phone) "
                        "VALUES (%s, %s, %s, %s, %s, %s) "
                        "RETURNING id, username, email, full_name, department, phone",
                        (username, username, full_name, hash_password(password), department, phone)
                    )
                    user = cur.fetchone()
                token = make_token(user['id'])
                return {'statusCode': 200, 'headers': cors,
                        'body': json.dumps({'token': token, 'user': dict(user)})}

            if action == 'login':
                username = (body.get('username') or '').strip().lower()
                password = body.get('password') or ''
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        "SELECT id, username, email, full_name, department, phone, password_hash "
                        "FROM users WHERE username = %s", (username,)
                    )
                    user = cur.fetchone()
                if not user or user['password_hash'] != hash_password(password):
                    return {'statusCode': 401, 'headers': cors,
                            'body': json.dumps({'error': 'Неверное имя пользователя или пароль'})}
                token = make_token(user['id'])
                user_data = {k: v for k, v in user.items() if k != 'password_hash'}
                return {'statusCode': 200, 'headers': cors,
                        'body': json.dumps({'token': token, 'user': user_data})}

            return {'statusCode': 400, 'headers': cors,
                    'body': json.dumps({'error': 'Неизвестное действие'})}

        if method == 'GET':
            token = event.get('headers', {}).get('X-Auth-Token') or event.get('headers', {}).get('x-auth-token')
            user_id = parse_user_id(token)
            if not user_id:
                return {'statusCode': 401, 'headers': cors,
                        'body': json.dumps({'error': 'Не авторизован'})}
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, username, email, full_name, department, phone FROM users WHERE id = %s",
                    (user_id,)
                )
                user = cur.fetchone()
            if not user:
                return {'statusCode': 404, 'headers': cors,
                        'body': json.dumps({'error': 'Пользователь не найден'})}
            return {'statusCode': 200, 'headers': cors,
                    'body': json.dumps({'user': dict(user)})}

        return {'statusCode': 405, 'headers': cors,
                'body': json.dumps({'error': 'Метод не поддерживается'})}
    finally:
        conn.close()