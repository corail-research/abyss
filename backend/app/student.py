import pandas as pd
import jwt

from flask import request, jsonify, current_app, make_response
from flask_restx import Resource
from flask_bcrypt import Bcrypt
from flask_jwt_extended import (
        create_access_token, jwt_required,
        get_jwt_identity, verify_jwt_in_request,
        get_jwt, set_access_cookies)
from flask_jwt_extended.exceptions import CSRFError
from jwt import ExpiredSignatureError

from backend.db import db

from backend.models.schemas import StudentSchemaAdmin, StudentSchema
from backend.models import Student, Group
from backend.app.utils import log_and_return

from backend.app.api import (
        api, admin_required, student_model, student_non_admin_model,
        update_student_model, login_student_model)


bcrypt = Bcrypt()

student_ns = api.namespace('students', description='Student operations')


@student_ns.route('')
class StudentCollection(Resource):
    @admin_required
    @student_ns.expect(student_model)
    @student_ns.marshal_with(student_model)
    def post(self):
        try:
            data = request.get_json()

            required_values = {"password", "username"}
            if "role" not in data:
                data["role"] = "student"
                
            if data["role"] == "student":
                required_values.add("group_id")

            if required_values.issubset(data):
                data['password'] = bcrypt.generate_password_hash(data['password']).decode('utf-8')
                if "id" in data and Student.query.filter_by(id=data['id']).first():
                    return log_and_return(current_app.logger,'Attempt to create a student with an existing student number', 'warning', 403)

                if data["role"] == "student":
                    group = Group.query.get(data['group_id'])
                    if group:
                        new_student = Student(**data)
                        db.session.add(new_student)
                        db.session.commit()
                        log_and_return(current_app.logger,f'Student {new_student.username} created', status_code=201)
                        return StudentSchema().dump(new_student), 201
                    else:
                        return log_and_return(current_app.logger,'Attempt to create a student with a non-existing group', 'warning', 403)
                else:
                    new_student = Student(**data)
                    db.session.add(new_student)
                    db.session.commit()
                    log_and_return(current_app.logger,f'Admin {new_student.username} created', status_code=201)
                    return StudentSchema().dump(new_student), 201
            else:
                return log_and_return(current_app.logger,'Missing information', "warning", 400)
                
        except jwt.ExpiredSignatureError:
            return log_and_return(current_app.logger,'Token expired', 'warning', 401)
        except jwt.InvalidSignatureError:
            return log_and_return(current_app.logger,'Invalid signature', 'warning', 401)
        except Exception as e:
            return log_and_return(current_app.logger,f'Unexpected Error: {str(e)}', 'error', 500)

    @student_ns.marshal_list_with(student_non_admin_model)
    def get(self):
        students = Student.query.all()
        return StudentSchema().dump(students, many=True)

@student_ns.route('/full_student')
class StudentCollectionAdmin(Resource):
    @admin_required
    @student_ns.marshal_list_with(student_model)
    def get(self):
        students = Student.query.all()
        return StudentSchemaAdmin().dump(students, many=True)


@student_ns.route('/loadCSV')
class StudentLoadCSV(Resource):
    @admin_required
    def post(self):
        try:
            file = request.files['file']
            new_students = []
            if file and file.filename.endswith('.csv'):
                df = pd.read_csv(file, sep=',')
                for _, row in df.iterrows():
                    data = {
                        'username': row['username'],
                        'id': int(row['student_id']),
                        'group_id': row['group_id'],
                        'password': bcrypt.generate_password_hash(str(row['password'])).decode('utf-8'),
                        'role': row['role']
                    }
                    
                    if Student.query.filter_by(id=data['id']).first():
                        return log_and_return(current_app.logger,'Attempt to create a student with an existing student number', 'warning', 403)

                    group = Group.query.get(data['group_id'])
                    if group:
                        new_students.append(Student(**data))
                    else:
                        return log_and_return(current_app.logger,'Attempt to create a student in a non-existing group', 'warning', 403)
                
                db.session.add_all(new_students)
                db.session.commit() 
                log_and_return(current_app.logger,'Student CSV loaded', status_code=201)
                return StudentSchema().dump(new_students, many=True), 201
            else:
                return log_and_return(current_app.logger,'Attempt to upload a file with an invalid extension', 'warning', 403)
        except Exception as e:
            return log_and_return(current_app.logger,f'Unexpected Error: {str(e)}', 'error', 500)

@student_ns.route('/<int:id>')
class StudentItem(Resource):
    @student_ns.marshal_with(student_non_admin_model)
    def get(self, id):
        student = Student.query.get_or_404(id)
        return StudentSchema().dump(student)
    
    @admin_required
    @student_ns.expect(update_student_model)
    def patch(self, id):
        student = Student.query.get_or_404(id)
        try:
            data = request.get_json()

            student.id = data.get('id', student.id)
            student.username = data.get('username', student.username)
            student.group_id = data.get('group_id', student.group_id)
            student.role = data.get('role', student.role)

            if "password" in data:
                student.password = bcrypt.generate_password_hash(data["password"]).decode('utf-8')

            db.session.commit()

            log_and_return(current_app.logger,f'Student {student.username} patched', status_code=200)
            return StudentSchema().dump(student)
        
        except Exception as e:
            return log_and_return(current_app.logger,f'Unexpected Error: {str(e)}', 'error', 500)
    
    @admin_required
    def delete(self, id):
        student = Student.query.get_or_404(id)
        # # Check whether the student is the last one in the group
        # group = Group.query.get(student.group_id) if student.group_id else None
        # if group and len(group.students) == 1:
        #     return log_and_return(current_app.logger,'Attempt to delete the last student in a group', 'warning', 403)
        db.session.delete(student)
        db.session.commit()
        return log_and_return(current_app.logger,f'Student {student.username} deleted', status_code=204)

@student_ns.route('/profile')
class StudentProfile(Resource):
    @jwt_required()
    def get(self):
        try:
            current_user = get_jwt_identity()
            student = Student.query.get(current_user['id'])
            return StudentSchema().dump(student)

        except Exception as e:
            return log_and_return(current_app.logger,f'Unexpected Error: {str(e)}', 'error', 500)
        
@student_ns.route('/login')
class StudentLogin(Resource):
    @student_ns.expect(login_student_model)
    def post(self):
        try:
            data = request.get_json()
            if not data.get('id') or not data.get('password'):
                return log_and_return(current_app.logger,'Attempt to login with missing credentials', 'warning', 400)
            student = Student.query.filter_by(id=data['id']).first()
            if not student:
                return log_and_return(current_app.logger,'Attempt to login with a non-existing student number', 'warning', 404)
            
            if bcrypt.check_password_hash(student.password, data['password']):
                student_infos = {'id': student.id, 'username': student.username, 'role': student.role, 'group_id': student.group_id}
                response = jsonify(msg="login successful", identity=student_infos)
                access_token = create_access_token(identity=student_infos)
                set_access_cookies(response, access_token, max_age=current_app.config["JWT_ACCESS_TOKEN_EXPIRES"].seconds)
                return response
            else:
                return log_and_return(current_app.logger,'Attempt to login with an incorrect password', 'warning', 401)
        except Exception as e:
            return log_and_return(current_app.logger,f'Unexpected Error: {str(e)}', 'error', 500)


@student_ns.route('/connected')
class StudentConnected(Resource):
    def post(self):
        try:
            if verify_jwt_in_request(optional=True) is not None:
                current_user = get_jwt_identity()
                student = Student.query.get(current_user['id'])

                if student is not None:
                    log_and_return(current_app.logger,'User connected', status_code=200)
                    return make_response(jsonify(message="User connected", connected=True, identity=
                                                 {'id': student.id, 'username': student.username, 'role': student.role, 'group_id': student.group_id}))
                else:
                    log_and_return(current_app.logger,'Invalid session', "warning", 401)
                    return make_response(jsonify(message="Invalid session", connected=False, identity={}), 401)
            else:
                log_and_return(current_app.logger,'Not connected', status_code=200)
                return make_response(jsonify(message="Not connected", connected=False, identity={}), 200)
        except CSRFError as _:
            log_and_return(current_app.logger,'Not connected: Missing CSRF token', status_code=200)
            return make_response(jsonify(message="Not connected: Missing CSRF token", connected=False, identity={}), 200)
        except ExpiredSignatureError as _:
            log_and_return(current_app.logger,'Not connected: Signature has expired', status_code=200)
            return make_response(jsonify(message="Not connected: Signature has expired", connected=False, identity={}), 200)
        except Exception as e:
            return log_and_return(current_app.logger,f'Unexpected Error: {str(e)}', 'error', 500)

@student_ns.route("/logout")
class StudentLogout(Resource):
    @jwt_required(verify_type=False)
    def delete(self):
        try:
            token = get_jwt()
            jti = token["jti"]

            current_app.config["REDIS"].set(jti, "", ex=current_app.config["JWT_ACCESS_TOKEN_EXPIRES"])
            log_and_return(current_app.logger,"Access token successfully revoked", status_code=200)
            return jsonify(message="Access token successfully revoked")
        except Exception as e:
            return log_and_return(current_app.logger,f'Unexpected Error: {str(e)}', 'error', 500)

@student_ns.route('/admin_check')
class StudentAdminCheck(Resource):
    @jwt_required()
    def get(self):
        try:
            current_user = get_jwt_identity()
            student = Student.query.get(current_user['id'])
            if student.role == 'admin':
                log_and_return(current_app.logger,'User is admin', status_code=200)
                return jsonify(message="User is admin", is_admin=True, identity={})
            else:
                log_and_return(current_app.logger,'User is not admin', status_code=200)
                return jsonify(message="User is not admin", is_admin=False, identity=
                               {'id': student.id, 'username': student.username, 'role': student.role})
            
        except Exception as e:
            return log_and_return(current_app.logger,f'Unexpected Error: {str(e)}', 'error', 500)
        
