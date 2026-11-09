-- DropForeignKey
ALTER TABLE "ativo" DROP CONSTRAINT "fk_ativo_dominio";

-- DropForeignKey
ALTER TABLE "catalogo_modelo_fundacional" DROP CONSTRAINT "fk_catalogo_modelo_responsavel";

-- DropForeignKey
ALTER TABLE "contextualizacao_avaliacao" DROP CONSTRAINT "fk_contextualizacao_ativo";

-- DropForeignKey
ALTER TABLE "decisao" DROP CONSTRAINT "fk_decisao_ativo";

-- DropForeignKey
ALTER TABLE "decisao" DROP CONSTRAINT "fk_decisao_responsavel";

-- DropForeignKey
ALTER TABLE "dominio" DROP CONSTRAINT "fk_dominio_owner";

-- DropForeignKey
ALTER TABLE "log_auditoria" DROP CONSTRAINT "fk_log_auditoria_usuario";

-- DropForeignKey
ALTER TABLE "motor_enquadramento" DROP CONSTRAINT "fk_motor_enquadramento_ativo";

-- DropForeignKey
ALTER TABLE "papel_ativo" DROP CONSTRAINT "fk_papel_ativo_ativo";

-- DropForeignKey
ALTER TABLE "papel_ativo" DROP CONSTRAINT "fk_papel_ativo_pessoa";

-- DropForeignKey
ALTER TABLE "refresh_token" DROP CONSTRAINT "fk_refresh_token_pessoa";

-- AddForeignKey
ALTER TABLE "ativo" ADD CONSTRAINT "fk_ativo_dominio" FOREIGN KEY ("dominio_id") REFERENCES "dominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogo_modelo_fundacional" ADD CONSTRAINT "fk_catalogo_modelo_responsavel" FOREIGN KEY ("responsavel_id") REFERENCES "pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contextualizacao_avaliacao" ADD CONSTRAINT "fk_contextualizacao_ativo" FOREIGN KEY ("ativo_id") REFERENCES "ativo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisao" ADD CONSTRAINT "fk_decisao_ativo" FOREIGN KEY ("ativo_id") REFERENCES "ativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisao" ADD CONSTRAINT "fk_decisao_responsavel" FOREIGN KEY ("responsavel_id") REFERENCES "pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dominio" ADD CONSTRAINT "fk_dominio_owner" FOREIGN KEY ("owner_id") REFERENCES "pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_auditoria" ADD CONSTRAINT "fk_log_auditoria_usuario" FOREIGN KEY ("usuario_id") REFERENCES "pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motor_enquadramento" ADD CONSTRAINT "fk_motor_enquadramento_ativo" FOREIGN KEY ("ativo_id") REFERENCES "ativo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papel_ativo" ADD CONSTRAINT "fk_papel_ativo_ativo" FOREIGN KEY ("ativo_id") REFERENCES "ativo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papel_ativo" ADD CONSTRAINT "fk_papel_ativo_pessoa" FOREIGN KEY ("pessoa_id") REFERENCES "pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "fk_refresh_token_pessoa" FOREIGN KEY ("pessoa_id") REFERENCES "pessoa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
